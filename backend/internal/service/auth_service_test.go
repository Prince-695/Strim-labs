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
	authRepo   repository.AuthRepository
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
		JWTSecret:       "strim-labs-test-secret-32-chars-long!",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	idGen := ids.NewUUIDv7Generator()
	userRepo := repository.NewInMemoryUserRepository()
	authRepo := repository.NewInMemoryAuthRepository()
	otpRepo := repository.NewInMemoryOTPRepository()
	mockMailer := mailer.NewMockMailer()
	tokenCache := cache.NewMemoryCache()
	clk := clock.NewRealClock()

	authSvc := service.NewAuthService(
		cfg,
		userRepo,
		authRepo,
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
		authRepo:   authRepo,
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
		Email:     "developer@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Grace",
		LastName:  "Hopper",
	}

	user, accessToken, refreshToken, err := h.authSvc.Signup(ctx, req, "Mozilla/5.0", "127.0.0.1")
	require.NoError(t, err)
	require.NotNil(t, user)
	assert.Equal(t, "developer@strimlabs.dev", user.Email)
	assert.Equal(t, "Grace", user.FirstName)
	assert.Equal(t, "Hopper", user.LastName)
	assert.False(t, user.IsVerified)

	assert.NotEmpty(t, accessToken)
	assert.NotEmpty(t, refreshToken)

	// Verify claims in access token
	claims, err := crypto.ValidateAccessToken(accessToken, h.cfg.JWTSecret)
	require.NoError(t, err)
	assert.Equal(t, user.ID, claims.Subject)
	assert.Equal(t, user.Email, claims.Email)
	assert.False(t, claims.IsVerified)

	// Verify OTP email was sent
	sentMails := h.mockMailer.SentEmails()
	require.Len(t, sentMails, 1)
	assert.Equal(t, "developer@strimlabs.dev", sentMails[0].ToEmail)
	assert.Equal(t, "email_verification", sentMails[0].Purpose)
}

func TestAuthService_Signup_DuplicateEmail(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	req := domain.SignupRequest{
		Email:     "dupe@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Ada",
		LastName:  "Lovelace",
	}

	_, _, _, err := h.authSvc.Signup(ctx, req, "agent", "127.0.0.1")
	require.NoError(t, err)

	// Second signup with same email must fail
	_, _, _, err = h.authSvc.Signup(ctx, req, "agent", "127.0.0.1")
	require.Error(t, err)

	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeEmailTaken, appErr.ErrorCode)
}

func TestAuthService_Login_Success(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "auth_user@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Linus",
		LastName:  "Torvalds",
	}
	_, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	loginReq := domain.LoginRequest{
		Email:    "auth_user@strimlabs.dev",
		Password: "Str0ng!P@ssw0rd2026",
	}
	user, access, refresh, err := h.authSvc.Login(ctx, loginReq, "Mozilla/5.0", "127.0.0.1")
	require.NoError(t, err)
	assert.NotNil(t, user)
	assert.NotEmpty(t, access)
	assert.NotEmpty(t, refresh)
}

func TestAuthService_Login_InvalidPassword_And_Lockout(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "lockout_user@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Alan",
		LastName:  "Turing",
	}
	_, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	badReq := domain.LoginRequest{
		Email:    "lockout_user@strimlabs.dev",
		Password: "WrongPassword!123",
	}

	// 10 failed login attempts per API.md Section 1.5
	for i := 1; i <= 10; i++ {
		_, _, _, err := h.authSvc.Login(ctx, badReq, "agent", "127.0.0.1")
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

func TestAuthService_Refresh_Rotation_And_FamilyRevocation(t *testing.T) {
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

	// 2. Refresh with token2 should succeed (token2 -> token3)
	_, _, refreshToken3, err := h.authSvc.Refresh(ctx, refreshToken2, "agent", "127.0.0.1")
	require.NoError(t, err)
	assert.NotEmpty(t, refreshToken3)

	// 3. Attempt reuse of revoked token1 (Simulated Replay Attack)
	_, _, _, err = h.authSvc.Refresh(ctx, refreshToken1, "agent", "127.0.0.1")
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeTokenReused, appErr.ErrorCode)

	// 4. Family revocation check: token3 must now be revoked as well!
	_, _, _, err = h.authSvc.Refresh(ctx, refreshToken3, "agent", "127.0.0.1")
	require.Error(t, err)
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

	// JTI should be reported as revoked
	assert.True(t, h.authSvc.IsTokenRevoked(claims.ID))

	// Refresh token should no longer work
	_, _, _, err = h.authSvc.Refresh(ctx, refreshToken, "agent", "127.0.0.1")
	require.Error(t, err)
}

func TestAuthService_PasswordResetFlow(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "reset_flow@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Ken",
		LastName:  "Thompson",
	}
	_, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)

	// 1. Request forgot password
	err = h.authSvc.ForgotPassword(ctx, "reset_flow@strimlabs.dev")
	require.NoError(t, err)

	sentMails := h.mockMailer.SentEmails()
	require.Len(t, sentMails, 2) // 1 from signup, 1 from forgot password
	resetMail := sentMails[1]
	assert.Equal(t, "reset_flow@strimlabs.dev", resetMail.ToEmail)
	assert.Equal(t, "password_reset", resetMail.Purpose)

	// Extract 6-digit OTP code from mail body
	activeOTP, err := h.otpRepo.FindLatestActive(ctx, "reset_flow@strimlabs.dev", "password_reset")
	require.NoError(t, err)
	assert.NotNil(t, activeOTP)

	// Find the raw code from the email body (it contains "is: 123456")
	// Or we can reset using wrong OTP first
	badReset := domain.ResetPasswordRequest{
		Email:       "reset_flow@strimlabs.dev",
		OTP:         "000000",
		NewPassword: "BrandNewSecurePass!2026",
	}
	err = h.authSvc.ResetPassword(ctx, badReset)
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeOTPInvalid, appErr.ErrorCode)
}

func TestAuthService_OTPVerification(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "otp_verify@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Barbara",
		LastName:  "Liskov",
	}
	user, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent", "127.0.0.1")
	require.NoError(t, err)
	assert.False(t, user.IsVerified)

	// Request new verification OTP
	err = h.authSvc.SendVerificationOTP(ctx, user.ID)
	require.NoError(t, err)

	// Attempt verification with invalid code
	_, err = h.authSvc.VerifyOTP(ctx, user.ID, "999999")
	require.Error(t, err)
}

func TestAuthService_SessionsListAndRevocation(t *testing.T) {
	h := newTestHarness(t)
	ctx := context.Background()

	signupReq := domain.SignupRequest{
		Email:     "sessions@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Claude",
		LastName:  "Shannon",
	}
	user, _, _, err := h.authSvc.Signup(ctx, signupReq, "agent1", "10.0.0.1")
	require.NoError(t, err)

	// Login again from a second device
	_, _, _, err = h.authSvc.Login(ctx, domain.LoginRequest{
		Email:    "sessions@strimlabs.dev",
		Password: "Str0ng!P@ssw0rd2026",
	}, "agent2", "10.0.0.2")
	require.NoError(t, err)

	// List sessions
	sessions, err := h.authSvc.ListSessions(ctx, user.ID, "")
	require.NoError(t, err)
	assert.Len(t, sessions, 2)

	// Revoke first session
	targetID := sessions[0].ID
	err = h.authSvc.RevokeSession(ctx, user.ID, targetID)
	require.NoError(t, err)

	// List sessions again
	remaining, err := h.authSvc.ListSessions(ctx, user.ID, "")
	require.NoError(t, err)
	assert.Len(t, remaining, 1)
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
