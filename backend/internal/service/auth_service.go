package service

import (
	"context"
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

// AuthService defines all business operations for authentication and sessions.
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
	ListSessions(ctx context.Context, userID, currentSessionID string) ([]domain.SessionResponse, error)
	RevokeSession(ctx context.Context, userID, sessionID string) error
	IsTokenRevoked(jti string) bool
}

type authService struct {
	cfg       *config.Config
	userRepo  repository.UserRepository
	authRepo  repository.AuthRepository
	otpRepo   repository.OTPRepository
	oauthRepo repository.OAuthRepository
	mailer    mailer.Mailer
	denylist  cache.Cache
	clk       clock.Clock
	idGen     ids.IDGenerator
	logger    *slog.Logger
}

// NewAuthService creates a new AuthService instance with all dependencies injected.
func NewAuthService(
	cfg *config.Config,
	userRepo repository.UserRepository,
	authRepo repository.AuthRepository,
	otpRepo repository.OTPRepository,
	oauthRepo repository.OAuthRepository,
	mailer mailer.Mailer,
	denylist cache.Cache,
	clk clock.Clock,
	idGen ids.IDGenerator,
	logger *slog.Logger,
) AuthService {
	return &authService{
		cfg:       cfg,
		userRepo:  userRepo,
		authRepo:  authRepo,
		otpRepo:   otpRepo,
		oauthRepo: oauthRepo,
		mailer:    mailer,
		denylist:  denylist,
		clk:       clk,
		idGen:     idGen,
		logger:    logger,
	}
}

// Signup registers a new user, sends email verification OTP, and issues session tokens.
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
		FirstName:    strings.TrimSpace(req.FirstName),
		LastName:     strings.TrimSpace(req.LastName),
		IsVerified:   false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return nil, "", "", domain.NewEmailTakenError()
		}
		return nil, "", "", domain.NewInternalError(err)
	}

	// 4. Issue session tokens (Family rotation)
	familyID := s.idGen.MustNewUUIDv7()
	sessionID := s.idGen.MustNewUUIDv7()
	rawRefreshToken, tokenHash, err := crypto.GenerateOpaqueToken()
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	refreshTokenModel := &domain.RefreshToken{
		ID:        sessionID,
		UserID:    user.ID,
		FamilyID:  familyID,
		TokenHash: tokenHash,
		UserAgent: userAgent,
		IP:        ip,
		ExpiresAt: now.Add(s.cfg.RefreshTokenTTL),
		CreatedAt: now,
	}

	if err := s.authRepo.CreateRefreshToken(ctx, refreshTokenModel); err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	accessToken, _, err := crypto.GenerateAccessToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.AccessTokenTTL, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	// 5. Generate and dispatch verification OTP
	code, codeHash, err := crypto.GenerateOTP()
	if err == nil {
		otp := &domain.OTPCode{
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
	return &resp, accessToken, rawRefreshToken, nil
}

// Login authenticates credentials, tracks failed attempts, and creates a new session.
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
	match, err := crypto.VerifyPassword(req.Password, user.PasswordHash)
	if err != nil || !match {
		s.incrementFailedLogin(lockKey)
		return nil, "", "", domain.NewInvalidCredentialsError()
	}

	// Reset failed attempts on success
	s.denylist.Delete(lockKey)

	// Issue session tokens
	now := s.clk.Now()
	familyID := s.idGen.MustNewUUIDv7()
	sessionID := s.idGen.MustNewUUIDv7()
	rawRefreshToken, tokenHash, err := crypto.GenerateOpaqueToken()
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	refreshTokenModel := &domain.RefreshToken{
		ID:        sessionID,
		UserID:    user.ID,
		FamilyID:  familyID,
		TokenHash: tokenHash,
		UserAgent: userAgent,
		IP:        ip,
		ExpiresAt: now.Add(s.cfg.RefreshTokenTTL),
		CreatedAt: now,
	}

	if err := s.authRepo.CreateRefreshToken(ctx, refreshTokenModel); err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	accessToken, _, err := crypto.GenerateAccessToken(user.ID, sessionID, user.Email, user.IsVerified, s.cfg.AccessTokenTTL, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	resp := domain.ToUserResponse(user)
	return &resp, accessToken, rawRefreshToken, nil
}

// Refresh rotates a refresh token and detects reuse attacks.
func (s *authService) Refresh(ctx context.Context, rawRefreshToken, userAgent, ip string) (*domain.UserResponse, string, string, error) {
	if rawRefreshToken == "" {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	tokenHash := crypto.HashToken(rawRefreshToken)
	token, err := s.authRepo.FindRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	now := s.clk.Now()

	// Reuse detection: If token was already revoked, an adversary has replayed a stolen token!
	if token.RevokedAt != nil {
		s.logger.WarnContext(ctx, "CRITICAL: Refresh token reuse detected, revoking session family",
			slog.String("family_id", token.FamilyID),
			slog.String("user_id", token.UserID),
		)
		_ = s.authRepo.RevokeFamily(ctx, token.FamilyID)
		return nil, "", "", domain.NewTokenReusedError()
	}

	// Expiration check
	if now.After(token.ExpiresAt) {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	// Fetch user
	user, err := s.userRepo.FindByID(ctx, token.UserID)
	if err != nil {
		return nil, "", "", domain.NewTokenExpiredError()
	}

	// Generate new token in same family
	newRawToken, newHash, err := crypto.GenerateOpaqueToken()
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	newSessionID := s.idGen.MustNewUUIDv7()
	newToken := &domain.RefreshToken{
		ID:        newSessionID,
		UserID:    user.ID,
		FamilyID:  token.FamilyID,
		TokenHash: newHash,
		UserAgent: userAgent,
		IP:        ip,
		ExpiresAt: now.Add(s.cfg.RefreshTokenTTL),
		CreatedAt: now,
	}

	// Revoke old token and link replaced_by
	if err := s.authRepo.RevokeRefreshToken(ctx, tokenHash, newHash); err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	if err := s.authRepo.CreateRefreshToken(ctx, newToken); err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	accessToken, _, err := crypto.GenerateAccessToken(user.ID, newSessionID, user.Email, user.IsVerified, s.cfg.AccessTokenTTL, s.cfg.JWTSecret)
	if err != nil {
		return nil, "", "", domain.NewInternalError(err)
	}

	resp := domain.ToUserResponse(user)
	return &resp, accessToken, newRawToken, nil
}

// Logout revokes the refresh token and adds the access token JTI to the denylist.
func (s *authService) Logout(ctx context.Context, rawRefreshToken, accessJTI string, accessExpiresAt time.Time) error {
	if rawRefreshToken != "" {
		tokenHash := crypto.HashToken(rawRefreshToken)
		_ = s.authRepo.RevokeRefreshToken(ctx, tokenHash, "")
	}

	if accessJTI != "" {
		remaining := accessExpiresAt.Sub(s.clk.Now())
		if remaining > 0 {
			s.denylist.Set("jti:"+accessJTI, true, remaining)
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
		ExpiresAt:  s.clk.Now().Add(s.cfg.AccessTokenTTL),
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

	otp := &domain.OTPCode{
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

// ResetPassword validates OTP, sets the new password, and revokes all active sessions.
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

	// Revoke all sessions across all devices
	_ = s.authRepo.RevokeAllUserSessions(ctx, user.ID)
	return nil
}

// ChangePassword updates password for an authenticated user and revokes other sessions.
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

	// Revoke other sessions
	_ = s.authRepo.RevokeAllUserSessions(ctx, user.ID)
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

	otp := &domain.OTPCode{
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

// ListSessions lists active sessions for user.
func (s *authService) ListSessions(ctx context.Context, userID, currentSessionID string) ([]domain.SessionResponse, error) {
	tokens, err := s.authRepo.ListActiveSessions(ctx, userID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	res := make([]domain.SessionResponse, len(tokens))
	for i, t := range tokens {
		res[i] = domain.SessionResponse{
			ID:        t.ID,
			UserAgent: t.UserAgent,
			IP:        t.IP,
			CreatedAt: t.CreatedAt,
			IsCurrent: t.ID == currentSessionID,
		}
	}
	return res, nil
}

// RevokeSession revokes an active session.
func (s *authService) RevokeSession(ctx context.Context, userID, sessionID string) error {
	return s.authRepo.RevokeSession(ctx, sessionID, userID)
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
