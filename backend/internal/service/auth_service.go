package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// GraceCachedTokenPair holds cached token pairs for concurrent in-flight refresh deduplication.
type GraceCachedTokenPair struct {
	User         *domain.UserResponse
	AccessToken  string
	RefreshToken string
}

// AuthService defines all business operations for stateless dual-token authentication.
type AuthService interface {
	Signup(ctx context.Context, req domain.SignupRequest, userAgent, ip string) (*domain.UserResponse, string, string, error)
	Login(ctx context.Context, req domain.LoginRequest, userAgent, ip string) (*domain.UserResponse, string, string, error)
	Refresh(ctx context.Context, rawRefreshToken, userAgent, ip string) (*domain.UserResponse, string, string, error)
	Logout(ctx context.Context, rawRefreshToken, accessJTI string, accessExpiresAt time.Time) error
	GetMe(ctx context.Context, userID, sessionID string) (*domain.AuthMeResponseData, error)
	ForgotPassword(ctx context.Context, email string) error
	ResetPassword(ctx context.Context, req domain.ResetPasswordRequest) error
	ChangePassword(ctx context.Context, userID string, req domain.ChangePasswordRequest) error
	SendVerificationOTP(ctx context.Context, userID string) error
	VerifyOTP(ctx context.Context, userID, code string) (*domain.UserResponse, error)
	HandleOAuthLogin(ctx context.Context, provider, providerUserID, email, firstName, lastName, userAgent, ip string) (*domain.UserResponse, string, string, error)
	IsTokenRevoked(jti string) bool
	IsUserRevoked(userID string, tokenIssuedAt time.Time) bool
}

type authService struct {
	cfg      *config.Config
	userRepo repository.UserRepository
	otpRepo  repository.OTPRepository
	mailer   mailer.Mailer
	denylist cache.Cache
	clk      clock.Clock
	idGen    ids.IDGenerator
	logger   *slog.Logger
}

// NewAuthService creates a new AuthService instance with stateless dual-token support.
func NewAuthService(
	cfg *config.Config,
	userRepo repository.UserRepository,
	otpRepo repository.OTPRepository,
	mailer mailer.Mailer,
	denylist cache.Cache,
	clk clock.Clock,
	idGen ids.IDGenerator,
	logger *slog.Logger,
) AuthService {
	return &authService{
		cfg:      cfg,
		userRepo: userRepo,
		otpRepo:  otpRepo,
		mailer:   mailer,
		denylist: denylist,
		clk:      clk,
		idGen:    idGen,
		logger:   logger,
	}
}

// Signup registers a new user, sends email verification OTP, and issues stateless dual-token pair.
func (s *authService) Signup(ctx context.Context, req domain.SignupRequest, userAgent, ip string) (*domain.UserResponse, string, string, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// 1. Check if email is already taken
	existing, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err == nil && existing != nil {
		return nil, "", "", domain.NewEmailTakenError()
	}

	// 2. Validate password policy & hash with Argon2id
	if valErr := crypto.ValidatePasswordPolicy(req.Password); valErr != nil {
		return nil, "", "", domain.NewValidationError(valErr.Error(), nil)
	}

	passwordHash, err := crypto.HashPassword(req.Password)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	// 3. Create user entity
	userID := s.idGen.MustNewUUIDv7()
	now := s.clk.Now()

	user := &domain.User{
		ID:           userID,
		Email:        req.Email,
		PasswordHash: passwordHash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		IsVerified:   false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") || strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, "", "", domain.NewEmailTakenError()
		}
		return nil, "", "", domain.NewInternalError(err)
	}

	// 4. Issue stateless dual-token pair (Access JWT 30m, Refresh JWT 7d)
	sessionID := s.idGen.MustNewUUIDv7()
	accessToken, _, err := crypto.GenerateAccessToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.AccessTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	refreshToken, _, err := crypto.GenerateRefreshToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.RefreshTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	// 5. Generate and dispatch verification OTP
	code, codeHash, err := crypto.GenerateOTP()
	if err == nil {
		otp := &domain.OTP{
			ID:        s.idGen.MustNewUUIDv7(),
			UserID:    &user.ID,
			Email:     user.Email,
			Purpose:   "email_verification",
			CodeHash:  codeHash,
			Attempts:  0,
			ExpiresAt: now.Add(10 * time.Minute),
			CreatedAt: now,
		}
		_ = s.otpRepo.CreateOTP(ctx, otp)
		_ = s.mailer.SendVerificationOTP(ctx, user.Email, user.FirstName, code)
	}

	resp := domain.ToUserResponse(user)
	return &resp, accessToken, refreshToken, nil
}

// Login authenticates credentials, checks lockout, and issues stateless dual-token pair.
func (s *authService) Login(ctx context.Context, req domain.LoginRequest, userAgent, ip string) (*domain.UserResponse, string, string, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	lockKey := "login_fail:" + req.Email

	// Check brute force lockout (10 attempts in 15 min)
	if attempts, ok := s.denylist.Get(lockKey); ok {
		if count, ok := attempts.(int); ok && count >= 10 {
			return nil, "", "", domain.NewAccountLockedError(900)
		}
	}

	// Find user
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		s.incrementFailedLogin(lockKey)
		return nil, "", "", domain.NewInvalidCredentialsError()
	}

	// Verify Argon2id password
	if user.PasswordHash == "" {
		s.incrementFailedLogin(lockKey)
		return nil, "", "", domain.NewInvalidCredentialsError()
	}
	match, err := crypto.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !match {
		s.incrementFailedLogin(lockKey)
		return nil, "", "", domain.NewInvalidCredentialsError()
	}

	// Reset failed attempts on success
	s.denylist.Delete(lockKey)

	// Issue stateless dual-token pair (Access JWT 30m, Refresh JWT 7d)
	sessionID := s.idGen.MustNewUUIDv7()
	accessToken, _, err := crypto.GenerateAccessToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.AccessTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	refreshToken, _, err := crypto.GenerateRefreshToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.RefreshTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	resp := domain.ToUserResponse(user)
	return &resp, accessToken, refreshToken, nil
}

// Refresh rotates a refresh token using Refresh Token Rotation (RTR) with a 30-second in-memory grace cache.
func (s *authService) Refresh(ctx context.Context, rawRefreshToken, userAgent, ip string) (*domain.UserResponse, string, string, error) {
	if rawRefreshToken == "" {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	// 1. Validate refresh JWT signature, expiration, and mandatory token_type="refresh"
	claims, err := crypto.ValidateRefreshToken(rawRefreshToken, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	// 2. Check in-memory 30-second grace cache to deduplicate concurrent in-flight refresh requests from parallel client calls
	graceKey := "grace:refresh:" + claims.ID
	if cached, ok := s.denylist.Get(graceKey); ok {
		if pair, valid := cached.(*GraceCachedTokenPair); valid {
			s.logger.DebugContext(ctx, "Serving deduplicated refresh token from grace cache", slog.String("jti", claims.ID))
			return pair.User, pair.AccessToken, pair.RefreshToken, nil
		}
	}

	// 3. Check in-memory TTL denylist (if JTI is revoked and beyond grace period, reject immediately)
	if s.IsTokenRevoked(claims.ID) {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	// 4. Check user-level revocation (e.g. password changed/reset across all devices)
	if claims.IssuedAt != nil && s.IsUserRevoked(claims.Subject, claims.IssuedAt.Time) {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	// 5. Verify user record exists in database
	user, err := s.userRepo.FindByID(ctx, claims.Subject)
	if err != nil || user == nil {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	now := s.clk.Now()

	// 6. Invalidate old refresh token: add JTI to in-memory TTL denylist until natural expiration
	remaining := s.cfg.RefreshTokenExpiry
	if claims.ExpiresAt != nil {
		remaining = claims.ExpiresAt.Time.Sub(now)
	}
	if remaining <= 0 {
		remaining = time.Minute
	}
	s.denylist.Set("jti:"+claims.ID, true, remaining)

	// 7. Generate brand-new token pair (Access JWT 30m, Refresh JWT 7d)
	newSessionID := s.idGen.MustNewUUIDv7()
	newAccessToken, _, err := crypto.GenerateAccessToken(user.ID, newSessionID, user.Email, user.IsVerified, s.cfg.AccessTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	newRefreshToken, _, err := crypto.GenerateRefreshToken(user.ID, newSessionID, user.Email, user.IsVerified, s.cfg.RefreshTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	userResp := domain.ToUserResponse(user)

	// 8. Cache the new token pair in the 30-second grace cache under the old token's JTI
	s.denylist.Set(graceKey, &GraceCachedTokenPair{
		User:         &userResp,
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
	}, 30*time.Second)

	return &userResp, newAccessToken, newRefreshToken, nil
}

// Logout revokes the refresh token and adds the access token JTI to the in-memory TTL denylist.
func (s *authService) Logout(ctx context.Context, rawRefreshToken, accessJTI string, accessExpiresAt time.Time) error {
	now := s.clk.Now()

	// 1. Invalidate access token JTI if provided
	if accessJTI != "" {
		remaining := accessExpiresAt.Sub(now)
		if remaining <= 0 {
			remaining = s.cfg.AccessTokenExpiry
		}
		s.denylist.Set("jti:"+accessJTI, true, remaining)
	}

	// 2. Invalidate refresh token JTI if provided
	if rawRefreshToken != "" {
		if claims, err := crypto.ValidateRefreshToken(rawRefreshToken, s.cfg.JWTSecret); err == nil && claims.ID != "" {
			remaining := s.cfg.RefreshTokenExpiry
			if claims.ExpiresAt != nil {
				remaining = claims.ExpiresAt.Time.Sub(now)
			}
			if remaining <= 0 {
				remaining = time.Minute
			}
			s.denylist.Set("jti:"+claims.ID, true, remaining)
			s.denylist.Delete("grace:refresh:" + claims.ID)
		}
	}

	return nil
}

func (s *authService) IsTokenRevoked(jti string) bool {
	if jti == "" {
		return false
	}
	_, found := s.denylist.Get("jti:" + jti)
	return found
}

func (s *authService) IsUserRevoked(userID string, tokenIssuedAt time.Time) bool {
	if userID == "" {
		return false
	}
	if revVal, ok := s.denylist.Get("user_revoked:" + userID); ok {
		if revTime, ok := revVal.(time.Time); ok {
			return !tokenIssuedAt.After(revTime)
		}
	}
	return false
}

// GetMe retrieves authenticated user information.
func (s *authService) GetMe(ctx context.Context, userID, sessionID string) (*domain.AuthMeResponseData, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, domain.NewNotFoundError("User profile not found")
	}

	return &domain.AuthMeResponseData{
		User:       domain.ToUserResponse(user),
		IsVerified: user.IsVerified,
		SessionID:  sessionID,
		ExpiresAt:  s.clk.Now().Add(s.cfg.AccessTokenExpiry),
	}, nil
}

// ForgotPassword generates a 6-digit OTP and dispatches a reset email (prevents account enumeration).
func (s *authService) ForgotPassword(ctx context.Context, email string) error {
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	user, err := s.userRepo.FindByEmail(ctx, normalizedEmail)
	if err != nil || user == nil {
		// Silent return to prevent user enumeration
		return nil
	}

	now := s.clk.Now()
	code, codeHash, err := crypto.GenerateOTP()
	if err != nil {
		return domain.NewInternalError(err)
	}

	otp := &domain.OTP{
		ID:        s.idGen.MustNewUUIDv7(),
		UserID:    &user.ID,
		Email:     user.Email,
		Purpose:   "password_reset",
		CodeHash:  codeHash,
		Attempts:  0,
		ExpiresAt: now.Add(10 * time.Minute),
		CreatedAt: now,
	}

	if err := s.otpRepo.CreateOTP(ctx, otp); err != nil {
		return domain.NewInternalError(err)
	}

	return s.mailer.SendPasswordResetOTP(ctx, user.Email, user.FirstName, code)
}

// ResetPassword validates OTP, sets the new password, and invalidates all active tokens across devices.
func (s *authService) ResetPassword(ctx context.Context, req domain.ResetPasswordRequest) error {
	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := s.userRepo.FindByEmail(ctx, normalizedEmail)
	if err != nil || user == nil {
		return domain.NewOTPInvalidError()
	}

	otp, err := s.otpRepo.FindLatestActive(ctx, normalizedEmail, "password_reset")
	if err != nil || otp == nil {
		return domain.NewOTPExpiredError()
	}

	if otp.Attempts >= 5 {
		return domain.NewOTPAttemptsExceededError()
	}

	expectedHash := crypto.HashToken(req.OTP)
	if otp.CodeHash != expectedHash {
		_, _ = s.otpRepo.IncrementAttempts(ctx, otp.ID)
		return domain.NewOTPInvalidError()
	}

	// Mark OTP used
	_ = s.otpRepo.MarkUsed(ctx, otp.ID)

	// Validate new password policy & hash
	if valErr := crypto.ValidatePasswordPolicy(req.NewPassword); valErr != nil {
		return domain.NewValidationError(valErr.Error(), nil)
	}

	newHash, err := crypto.HashPassword(req.NewPassword)
	if err != nil {
		return domain.NewInternalError(err)
	}

	if err := s.userRepo.UpdatePassword(ctx, user.ID, newHash); err != nil {
		return domain.NewInternalError(err)
	}

	// Invalidate all tokens for user across all devices with zero database lock overhead
	s.denylist.Set("user_revoked:"+user.ID, s.clk.Now(), s.cfg.RefreshTokenExpiry)
	return nil
}

// ChangePassword updates password for an authenticated user and invalidates other sessions.
func (s *authService) ChangePassword(ctx context.Context, userID string, req domain.ChangePasswordRequest) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return domain.NewNotFoundError("User not found")
	}

	match, err := crypto.VerifyPassword(req.OldPassword, user.PasswordHash)
	if err != nil || !match {
		return domain.NewAppError(400, domain.ErrCodeInvalidPassword, "Current password does not match", nil)
	}

	if valErr := crypto.ValidatePasswordPolicy(req.NewPassword); valErr != nil {
		return domain.NewValidationError(valErr.Error(), nil)
	}

	newHash, err := crypto.HashPassword(req.NewPassword)
	if err != nil {
		return domain.NewInternalError(err)
	}

	if err := s.userRepo.UpdatePassword(ctx, user.ID, newHash); err != nil {
		return domain.NewInternalError(err)
	}

	// Invalidate previous tokens for user across all devices
	s.denylist.Set("user_revoked:"+user.ID, s.clk.Now(), s.cfg.RefreshTokenExpiry)
	return nil
}

// SendVerificationOTP sends a 6-digit email confirmation code.
func (s *authService) SendVerificationOTP(ctx context.Context, userID string) error {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return domain.NewNotFoundError("User not found")
	}
	if user.IsVerified {
		return domain.NewAlreadyVerifiedError()
	}

	now := s.clk.Now()
	code, codeHash, err := crypto.GenerateOTP()
	if err != nil {
		return domain.NewInternalError(err)
	}

	otp := &domain.OTP{
		ID:        s.idGen.MustNewUUIDv7(),
		UserID:    &user.ID,
		Email:     user.Email,
		Purpose:   "email_verification",
		CodeHash:  codeHash,
		Attempts:  0,
		ExpiresAt: now.Add(10 * time.Minute),
		CreatedAt: now,
	}

	if err := s.otpRepo.CreateOTP(ctx, otp); err != nil {
		return domain.NewInternalError(err)
	}

	return s.mailer.SendVerificationOTP(ctx, user.Email, user.FirstName, code)
}

// VerifyOTP verifies email code and marks user as verified.
func (s *authService) VerifyOTP(ctx context.Context, userID, code string) (*domain.UserResponse, error) {
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, domain.NewNotFoundError("User not found")
	}
	if user.IsVerified {
		return nil, domain.NewAlreadyVerifiedError()
	}

	otp, err := s.otpRepo.FindLatestActive(ctx, user.Email, "email_verification")
	if err != nil || otp == nil {
		return nil, domain.NewOTPExpiredError()
	}

	if otp.Attempts >= 5 {
		return nil, domain.NewOTPAttemptsExceededError()
	}

	expectedHash := crypto.HashToken(code)
	if otp.CodeHash != expectedHash {
		_, _ = s.otpRepo.IncrementAttempts(ctx, otp.ID)
		return nil, domain.NewOTPInvalidError()
	}

	_ = s.otpRepo.MarkUsed(ctx, otp.ID)
	if err := s.userRepo.SetVerified(ctx, user.ID); err != nil {
		return nil, domain.NewInternalError(err)
	}

	user.IsVerified = true
	resp := domain.ToUserResponse(user)
	return &resp, nil
}

// HandleOAuthLogin authenticates or provisions a user using an OAuth provider (e.g. Google),
// automatically marking email as verified and issuing stateless dual-tokens.
func (s *authService) HandleOAuthLogin(ctx context.Context, provider, providerUserID, email, firstName, lastName, userAgent, ip string) (*domain.UserResponse, string, string, error) {
	normEmail := strings.ToLower(strings.TrimSpace(email))
	now := s.clk.Now()

	// 1. Try to find user by OAuth provider and provider user ID
	user, err := s.userRepo.FindByOAuth(ctx, provider, providerUserID)
	if err != nil && !errors.Is(err, repository.ErrUserNotFound) {
		return nil, "", "", domain.NewInternalError(err)
	}

	// 2. If not found by OAuth, try finding by email
	if user == nil {
		user, err = s.userRepo.FindByEmail(ctx, normEmail)
		if err != nil && !errors.Is(err, repository.ErrUserNotFound) {
			return nil, "", "", domain.NewInternalError(err)
		}

		if user != nil {
			// Link OAuth provider to existing user account and mark verified
			if linkErr := s.userRepo.LinkOAuth(ctx, user.ID, provider, providerUserID); linkErr != nil {
				return nil, "", "", domain.NewInternalError(linkErr)
			}
			user.OAuthProvider = &provider
			user.OAuthProviderID = &providerUserID
			user.IsVerified = true
		} else {
			// Provision brand-new user (OAuth accounts are automatically verified)
			newUser := &domain.User{
				ID:              s.idGen.MustNewUUIDv7(),
				Email:           normEmail,
				FirstName:       firstName,
				LastName:        lastName,
				OAuthProvider:   &provider,
				OAuthProviderID: &providerUserID,
				IsVerified:      true,
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			if createErr := s.userRepo.Create(ctx, newUser); createErr != nil {
				return nil, "", "", domain.NewInternalError(createErr)
			}
			user = newUser
		}
	}

	// 3. Issue stateless dual-tokens
	sessionID := s.idGen.MustNewUUIDv7()
	accessToken, _, err := crypto.GenerateAccessToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.AccessTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	refreshToken, _, err := crypto.GenerateRefreshToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.RefreshTokenExpiry, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	resp := domain.ToUserResponse(user)
	return &resp, accessToken, refreshToken, nil
}

func (s *authService) incrementFailedLogin(key string) {
	attempts, found := s.denylist.Get(key)
	if !found {
		s.denylist.Set(key, 1, 15*time.Minute)
		return
	}
	if count, ok := attempts.(int); ok {
		s.denylist.Set(key, count+1, 15*time.Minute)
	}
}
