package service_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testHarness struct {
	authSvc    service.AuthService
	userRepo   repository.UserRepository
	otpRepo    repository.OTPRepository
	mockMailer *mailer.MockMailer
	tokenCache cache.Cache
	clk        clock.Clock
	cfg        *config.Config
}

func newTestHarness(t *testing.T) *testHarness {
	cfg := &config.Config{
		AppEnv:          "test",
		ServerPort:      "8080",
		APIBaseURL:      "http://localhost:8080",
		WebOrigin:       "http://localhost:3000",
		AllowedOrigins:  []string{"http://localhost:3000"},
		LogLevel:        "error",
		RequestTimeout:  5 * time.Second,
		BodyLimitBytes:  2 * 1024 * 1024,
		JWTSecret:          "strim-labs-test-secret-32-chars-long!",
		AccessTokenExpiry:  30 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	idGen := ids.NewUUIDv7Generator()
	userRepo := repository.NewInMemoryUserRepository()
	otpRepo := repository.NewInMemoryOTPRepository()
	mockMailer := mailer.NewMockMailer()
	tokenCache := cache.NewMemoryCache()
	clk := clock.NewRealClock()

	authSvc := service.NewAuthService(
		cfg,
		userRepo,
		otpRepo,
		mockMailer,
		tokenCache,
		clk,
		idGen,
		logger,
	)

	return &testHarness{
		authSvc:    authSvc,
		userRepo:   userRepo,
		otpRepo:    otpRepo,
		mockMailer: mockMailer,
		tokenCache: tokenCache,
		clk:        clk,
		cfg:        cfg,
	}
}

func TestAuthService_Signup_Success(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	req := domain.SignupRequest{
		Email:     "ada.lovelace@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Ada",
		LastName:  "Lovelace",
	}

	user, access, refresh, err := h.authSvc.Signup(ctx, req, "Mozilla/5.0", "127.0.0.1")
	require.NoError(t, err)
	require.NotNil(t, user)
	assert.NotEmpty(t, user.ID)
	assert.Equal(t, "ada.lovelace@strimlabs.dev", user.Email)
	assert.False(t, user.IsVerified)
	assert.NotEmpty(t, access)
	assert.NotEmpty(t, refresh)

	// Validate Access Token contains token_type="access"
	accessClaims, err := crypto.ValidateAccessToken(access, h.cfg.JWTSecret)
	require.NoError(t, err)
	assert.Equal(t, crypto.TokenTypeAccess, accessClaims.TokenType)
	assert.Equal(t, user.ID, accessClaims.Subject)

	// Validate Refresh Token contains token_type="refresh"
	refreshClaims, err := crypto.ValidateRefreshToken(refresh, h.cfg.JWTSecret)
	require.NoError(t, err)
	assert.Equal(t, crypto.TokenTypeRefresh, refreshClaims.TokenType)
	assert.Equal(t, user.ID, refreshClaims.Subject)

	// Verify welcome verification email was dispatched
	assert.Len(t, h.mockMailer.SentEmails(), 1)
}

func TestAuthService_Signup_DuplicateEmail(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	req := domain.SignupRequest{
		Email:     "duplicate@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Alan",
		LastName:  "Turing",
	}

	_, _, _, err := h.authSvc.Signup(ctx, req, "agent", "127.0.0.1")
	require.NoError(t, err)

	// Duplicate signup attempt
	_, _, _, err = h.authSvc.Signup(ctx, req, "agent", "127.0.0.1")
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeEmailTaken, appErr.ErrorCode)
	assert.Equal(t, 409, appErr.HTTPStatus)
}

func TestAuthService_Login_Success(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "grace.hopper@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Grace",
		LastName:  "Hopper",
	}
	_, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	// Successful login
	loginReq := domain.LoginRequest{
		Email:    "grace.hopper@strimlabs.dev",
		Password: "Str0ng!P@ssw0rd2026",
	}
	user, access, refresh, err := h.authSvc.Login(ctx, loginReq, "Mozilla/5.0", "127.0.0.1")
	require.NoError(t, err)
	assert.NotNil(t, user)
	assert.NotEmpty(t, access)
	assert.NotEmpty(t, refresh)

	// Cross-type validation: access token cannot be validated as refresh token
	_, err = crypto.ValidateRefreshToken(access, h.cfg.JWTSecret)
	require.Error(t, err)

	// Cross-type validation: refresh token cannot be validated as access token
	_, err = crypto.ValidateAccessToken(refresh, h.cfg.JWTSecret)
	require.Error(t, err)
}

func TestAuthService_Login_InvalidPassword_And_Lockout(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "lockout@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "John",
		LastName:  "VonNeumann",
	}
	_, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	badReq := domain.LoginRequest{
		Email:    "lockout@strimlabs.dev",
		Password: "WrongPassword123!",
	}

	// Fail 10 consecutive times (threshold is 10 per API spec)
	for i := 0; i < 10; i++ {
		_, _, _, err = h.authSvc.Login(ctx, badReq, "agent", "127.0.0.1")
		require.Error(t, err)
		appErr, ok := err.(*domain.AppError)
		require.True(t, ok)
		assert.Equal(t, domain.ErrCodeInvalidCredentials, appErr.ErrorCode)
	}

	// 11th attempt must be locked out with ACCOUNT_LOCKED (HTTP 429)
	_, _, _, err = h.authSvc.Login(ctx, badReq, "agent", "127.0.0.1")
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeAccountLocked, appErr.ErrorCode)
	assert.Equal(t, 429, appErr.HTTPStatus)
}

func TestAuthService_Refresh_Rotation_And_GraceCache(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "rotation@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Margaret",
		LastName:  "Hamilton",
	}
	_, _, refreshToken1, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	// 1. First rotation: token1 -> token2
	user, access2, refreshToken2, err := h.authSvc.Refresh(ctx, refreshToken1, "agent", "127.0.0.1")
	require.NoError(t, err)
	assert.NotNil(t, user)
	assert.NotEmpty(t, access2)
	assert.NotEmpty(t, refreshToken2)
	assert.NotEqual(t, refreshToken1, refreshToken2)

	// 2. In-flight concurrent request deduplication via 30-second Grace Cache:
	// Calling Refresh again with the same old refreshToken1 within 30s must return the cached pair!
	userGrace, accessGrace, refreshGrace, err := h.authSvc.Refresh(ctx, refreshToken1, "agent", "127.0.0.1")
	require.NoError(t, err, "Concurrent in-flight refresh request within grace period must succeed")
	assert.Equal(t, access2, accessGrace, "Access token from grace cache must match")
	assert.Equal(t, refreshToken2, refreshGrace, "Refresh token from grace cache must match")
	assert.Equal(t, user.ID, userGrace.ID)

	// 3. Normal second rotation: token2 -> token3
	user3, access3, refreshToken3, err := h.authSvc.Refresh(ctx, refreshToken2, "agent", "127.0.0.1")
	require.NoError(t, err)
	assert.NotNil(t, user3)
	assert.NotEmpty(t, access3)
	assert.NotEmpty(t, refreshToken3)

	// 4. Invalidate grace cache to simulate expired grace window (>30s)
	claims1, err := crypto.ValidateRefreshToken(refreshToken1, h.cfg.JWTSecret)
	require.NoError(t, err)
	h.tokenCache.Delete("grace:refresh:" + claims1.ID)

	// 5. Attempt reuse of token1 after grace window has expired: must fail as token is denylisted!
	_, _, _, err = h.authSvc.Refresh(ctx, refreshToken1, "agent", "127.0.0.1")
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeTokenExpired, appErr.ErrorCode)
}

func TestAuthService_Logout_And_Denylist(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "logout@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Dennis",
		LastName:  "Ritchie",
	}
	_, accessToken, refreshToken, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	claims, err := crypto.ValidateAccessToken(accessToken, h.cfg.JWTSecret)
	require.NoError(t, err)

	// Perform logout
	err = h.authSvc.Logout(ctx, refreshToken, claims.ID, claims.ExpiresAt.Time)
	require.NoError(t, err)

	// Access token JTI should be reported as revoked
	assert.True(t, h.authSvc.IsTokenRevoked(claims.ID))

	// Refresh token should no longer work
	_, _, _, err = h.authSvc.Refresh(ctx, refreshToken, "agent", "127.0.0.1")
	require.Error(t, err)
}

func TestAuthService_PasswordResetFlow(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "reset@strimlabs.dev",
		Password:  "OldP@ssw0rd2026!",
		FirstName: "Tim",
		LastName:  "BernersLee",
	}
	_, _, oldRefreshToken, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	// 1. Forgot password request
	err = h.authSvc.ForgotPassword(ctx, "reset@strimlabs.dev")
	require.NoError(t, err)

	otp, err := h.otpRepo.FindLatestActive(ctx, "reset@strimlabs.dev", "password_reset")
	require.NoError(t, err)
	require.NotNil(t, otp)

	// Extract dispatched OTP code from mock mailer
	lastEmail := h.mockMailer.LastEmail()
	require.NotNil(t, lastEmail)
	require.NotEmpty(t, lastEmail.OTP)

	// 2. Perform password reset with OTP
	resetReq := domain.ResetPasswordRequest{
		Email:       "reset@strimlabs.dev",
		OTP:         lastEmail.OTP,
		NewPassword: "BrandNewSecure!P@ss2026",
	}
	err = h.authSvc.ResetPassword(ctx, resetReq)
	require.NoError(t, err)

	// 3. Old refresh token must be invalidated by global user revocation!
	_, _, _, err = h.authSvc.Refresh(ctx, oldRefreshToken, "agent", "127.0.0.1")
	require.Error(t, err, "Tokens issued prior to password reset must be rejected")

	// 4. Verify login succeeds with new password
	_, newAccess, newRefresh, err := h.authSvc.Login(ctx, domain.LoginRequest{
		Email:    "reset@strimlabs.dev",
		Password: "BrandNewSecure!P@ss2026",
	}, "agent", "127.0.0.1")
	require.NoError(t, err)
	assert.NotEmpty(t, newAccess)
	assert.NotEmpty(t, newRefresh)
}

func TestAuthService_OTPVerification(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "verify@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Linus",
		LastName:  "Torvalds",
	}
	user, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, user.IsVerified)

	emails := h.mockMailer.SentEmails()
	require.NotEmpty(t, emails)
	code := emails[0].OTP

	// Verify with correct code
	verifiedUser, err := h.authSvc.VerifyOTP(ctx, user.ID, code)
	require.NoError(t, err)
	assert.True(t, verifiedUser.IsVerified)

	// Verifying again should return already verified error
	_, err = h.authSvc.VerifyOTP(ctx, user.ID, code)
	require.Error(t, err)
}

func TestAuthService_Stateless_GlobalRevocation_OnPasswordChange(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "change@strimlabs.dev",
		Password:  "Original!P@ss2026",
		FirstName: "Ken",
		LastName:  "Thompson",
	}
	user, _, oldRefresh, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	// Change password
	changeReq := domain.ChangePasswordRequest{
		OldPassword: "Original!P@ss2026",
		NewPassword: "Updated!P@ssw0rd2026",
	}
	err = h.authSvc.ChangePassword(ctx, user.ID, changeReq)
	require.NoError(t, err)

	// Old refresh token must be rejected
	_, _, _, err = h.authSvc.Refresh(ctx, oldRefresh, "agent", "127.0.0.1")
	require.Error(t, err)
}

func TestAuthService_HandleOAuthLogin(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	// 1. Provision new OAuth user
	user1, access1, refresh1, err := h.authSvc.HandleOAuthLogin(ctx, "github", "gh_987654", "octocat@strimlabs.dev", "Octo", "Cat", "Mozilla/5.0", "127.0.0.1")
	require.NoError(t, err)
	assert.NotEmpty(t, access1)
	assert.NotEmpty(t, refresh1)
	assert.Equal(t, "octocat@strimlabs.dev", user1.Email)
	assert.True(t, user1.IsVerified, "OAuth registered user must be auto-verified")

	// Validate dual-token claims
	claims1, err := crypto.ValidateAccessToken(access1, h.cfg.JWTSecret)
	require.NoError(t, err)
	assert.Equal(t, crypto.TokenTypeAccess, claims1.TokenType)

	rClaims1, err := crypto.ValidateRefreshToken(refresh1, h.cfg.JWTSecret)
	require.NoError(t, err)
	assert.Equal(t, crypto.TokenTypeRefresh, rClaims1.TokenType)

	// Verify domain entity in user repo
	dbUser1, err := h.userRepo.FindByID(ctx, user1.ID)
	require.NoError(t, err)
	assert.Empty(t, dbUser1.PasswordHash, "OAuth user should not have a password hash by default")
	require.NotNil(t, dbUser1.OAuthProvider)
	assert.Equal(t, "github", *dbUser1.OAuthProvider)
	require.NotNil(t, dbUser1.OAuthProviderID)
	assert.Equal(t, "gh_987654", *dbUser1.OAuthProviderID)

	// 2. Existing OAuth user logging in again
	user2, access2, refresh2, err := h.authSvc.HandleOAuthLogin(ctx, "github", "gh_987654", "octocat@strimlabs.dev", "Octo", "Cat", "Mozilla/5.0", "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, user1.ID, user2.ID)
	assert.NotEmpty(t, access2)
	assert.NotEmpty(t, refresh2)

	// 3. Existing email user linking OAuth account
	signupReq := domain.SignupRequest{
		Email:     "standard@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Standard",
		LastName:  "User",
	}
	existingUser, _, _, err := h.authSvc.Signup(ctx, signupReq, "Agent", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, existingUser.IsVerified)

	linkedUser, _, _, err := h.authSvc.HandleOAuthLogin(ctx, "google", "goog_12345", "standard@strimlabs.dev", "Standard", "User", "Agent", "127.0.0.1")
	require.NoError(t, err)
	assert.Equal(t, existingUser.ID, linkedUser.ID)
	assert.True(t, linkedUser.IsVerified, "Email should be verified after linking verified OAuth account")

	dbLinkedUser, err := h.userRepo.FindByID(ctx, linkedUser.ID)
	require.NoError(t, err)
	require.NotNil(t, dbLinkedUser.OAuthProvider)
	assert.Equal(t, "google", *dbLinkedUser.OAuthProvider)
	require.NotNil(t, dbLinkedUser.OAuthProviderID)
	assert.Equal(t, "goog_12345", *dbLinkedUser.OAuthProviderID)
	assert.NotEmpty(t, dbLinkedUser.PasswordHash, "Password should still exist for linked user")
}
