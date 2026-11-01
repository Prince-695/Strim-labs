package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// AuthHandler handles authentication, sessions, and recovery endpoints.
type AuthHandler struct {
	authSvc   service.AuthService
	cfg       *config.Config
	validator *validator.Validate
}

// NewAuthHandler creates an AuthHandler with injected services.
func NewAuthHandler(authSvc service.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		authSvc:   authSvc,
		cfg:       cfg,
		validator: validator.New(),
	}
}

// AuthService exposes the underlying auth service instance.
func (h *AuthHandler) AuthService() service.AuthService {
	return h.authSvc
}

// Signup godoc
// @Summary Register a new user account
// @Description Creates a new user, sends email verification OTP, and issues session tokens.
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.SignupRequest true "Signup payload"
// @Success 201 {object} domain.Response{data=domain.AuthResponseData} "Account created"
// @Failure 400 {object} domain.Response "Validation failed"
// @Failure 409 {object} domain.Response "Email already registered"
// @Failure 429 {object} domain.Response "Rate limited"
// @Router /v1/auth/signup [post]
func (h *AuthHandler) Signup(c *fiber.Ctx) error {
	var req domain.SignupRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	if err := h.validator.Struct(&req); err != nil {
		return domain.NewValidationError("Validation failed for signup parameters", formatValidationErrors(err))
	}

	user, accessToken, refreshToken, err := h.authSvc.Signup(c.Context(), req, c.Get("User-Agent"), c.IP())
	if err != nil {
		return err
	}

	setAuthCookies(c, h.cfg, accessToken, refreshToken)

	return c.Status(fiber.StatusCreated).JSON(domain.Response{
		Success:      true,
		Message:      "Account created. Please verify your email.",
		AccessToken:  accessToken,
		Data: domain.AuthResponseData{
			User:         *user,
			RefreshToken: refreshToken,
		},
		RequestID:    domain.GetRequestID(c),
		ResponseTime: domain.ComputeDuration(c),
	})
}

// Login godoc
// @Summary Authenticate user credentials
// @Description Verifies email and password, establishing a new session and issuing JWT and refresh tokens.
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.LoginRequest true "Login payload"
// @Success 200 {object} domain.Response{data=domain.AuthResponseData} "Successfully authenticated"
// @Failure 400 {object} domain.Response "Validation failed"
// @Failure 401 {object} domain.Response "Invalid email or password"
// @Failure 429 {object} domain.Response "Account locked or rate limited"
// @Router /v1/auth/login [post]
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req domain.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	if err := h.validator.Struct(&req); err != nil {
		return domain.NewValidationError("Validation failed for login parameters", formatValidationErrors(err))
	}

	user, accessToken, refreshToken, err := h.authSvc.Login(c.Context(), req, c.Get("User-Agent"), c.IP())
	if err != nil {
		return err
	}

	setAuthCookies(c, h.cfg, accessToken, refreshToken)

	return c.Status(fiber.StatusOK).JSON(domain.Response{
		Success:      true,
		Message:      "Login successful",
		AccessToken:  accessToken,
		Data: domain.AuthResponseData{
			User:         *user,
			RefreshToken: refreshToken,
		},
		RequestID:    domain.GetRequestID(c),
		ResponseTime: domain.ComputeDuration(c),
	})
}

// Refresh godoc
// @Summary Rotate refresh token
// @Description Rotates the active refresh token, issues a fresh access token, and detects reuse attacks.
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.RefreshRequest false "Optional body refresh token"
// @Success 200 {object} domain.Response{data=domain.AuthResponseData} "Tokens rotated"
// @Failure 401 {object} domain.Response "Token expired or reuse detected"
// @Router /v1/auth/refresh [post]
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req domain.RefreshRequest
	_ = c.BodyParser(&req)

	rawToken := strings.TrimSpace(req.RefreshToken)
	if rawToken == "" {
		rawToken = c.Cookies("refresh_token")
	}

	if rawToken == "" {
		return domain.NewTokenExpiredError()
	}

	user, newAccess, newRefresh, err := h.authSvc.Refresh(c.Context(), rawToken, c.Get("User-Agent"), c.IP())
	if err != nil {
		clearAuthCookies(c, h.cfg)
		return err
	}

	setAuthCookies(c, h.cfg, newAccess, newRefresh)

	return c.Status(fiber.StatusOK).JSON(domain.Response{
		Success:      true,
		Message:      "Session refreshed",
		AccessToken:  newAccess,
		Data: domain.AuthResponseData{
			User:         *user,
			RefreshToken: newRefresh,
		},
		RequestID:    domain.GetRequestID(c),
		ResponseTime: domain.ComputeDuration(c),
	})
}

// Logout godoc
// @Summary End user session
// @Description Revokes active refresh token, denylists access token, and clears authentication cookies.
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} domain.Response "Logged out"
// @Router /v1/auth/logout [post]
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	rawRefresh := c.Cookies("refresh_token")
	var jti string
	var exp time.Time

	if claims, ok := c.Locals(middleware.LocalsClaims).(*crypto.JWTClaims); ok && claims != nil {
		jti = claims.ID
		if claims.ExpiresAt != nil {
			exp = claims.ExpiresAt.Time
		}
	}

	_ = h.authSvc.Logout(c.Context(), rawRefresh, jti, exp)
	clearAuthCookies(c, h.cfg)

	return domain.SendMsg(c, "Logged out successfully")
}

// Me godoc
// @Summary Get current user profile
// @Description Retrieves profile and session details for the authenticated user.
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} domain.Response{data=domain.AuthMeResponseData} "User profile"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Router /v1/auth/me [get]
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	sessionID := middleware.GetSessionID(c)

	data, err := h.authSvc.GetMe(c.Context(), userID, sessionID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, data, nil)
}

// ForgotPassword godoc
// @Summary Request password reset OTP
// @Description Sends a 6-digit verification code to the registered email if the account exists.
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.ForgotPasswordRequest true "Forgot password request"
// @Success 200 {object} domain.Response "Code dispatched if account exists"
// @Failure 400 {object} domain.Response "Validation failed"
// @Failure 429 {object} domain.Response "Rate limited"
// @Router /v1/auth/forgot-password [post]
func (h *AuthHandler) ForgotPassword(c *fiber.Ctx) error {
	var req domain.ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	if err := h.validator.Struct(&req); err != nil {
		return domain.NewValidationError("Validation failed for email", formatValidationErrors(err))
	}

	_ = h.authSvc.ForgotPassword(c.Context(), req.Email)
	return domain.SendMsg(c, "If the account exists, a verification code was sent to your email")
}

// ResetPassword godoc
// @Summary Reset account password using OTP
// @Description Validates OTP and sets a new password, invalidating all existing sessions.
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body domain.ResetPasswordRequest true "Reset password request"
// @Success 200 {object} domain.Response "Password reset successful"
// @Failure 400 {object} domain.Response "Invalid or expired OTP"
// @Failure 429 {object} domain.Response "Attempt limit exceeded"
// @Router /v1/auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *fiber.Ctx) error {
	var req domain.ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	if err := h.validator.Struct(&req); err != nil {
		return domain.NewValidationError("Validation failed for reset password", formatValidationErrors(err))
	}

	if err := h.authSvc.ResetPassword(c.Context(), req); err != nil {
		return err
	}

	clearAuthCookies(c, h.cfg)
	return domain.SendMsg(c, "Password has been successfully reset. Please log in with your new password")
}

// ChangePassword godoc
// @Summary Change current account password
// @Description Allows authenticated users to change their password, revoking other sessions.
// @Tags Auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body domain.ChangePasswordRequest true "Change password request"
// @Success 200 {object} domain.Response "Password updated"
// @Failure 400 {object} domain.Response "Current password invalid"
// @Router /v1/auth/change-password [post]
func (h *AuthHandler) ChangePassword(c *fiber.Ctx) error {
	var req domain.ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	if err := h.validator.Struct(&req); err != nil {
		return domain.NewValidationError("Validation failed for password change", formatValidationErrors(err))
	}

	userID := middleware.GetUserID(c)
	if err := h.authSvc.ChangePassword(c.Context(), userID, req); err != nil {
		return err
	}

	return domain.SendMsg(c, "Password updated successfully")
}

// SendOTP godoc
// @Summary Send email verification code
// @Description Sends a 6-digit confirmation code to the authenticated user's email.
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} domain.Response "Verification code sent"
// @Failure 409 {object} domain.Response "Email already verified"
// @Router /v1/auth/otp/send [post]
func (h *AuthHandler) SendOTP(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if err := h.authSvc.SendVerificationOTP(c.Context(), userID); err != nil {
		return err
	}
	return domain.SendMsg(c, "Verification code sent to your email")
}

// VerifyOTP godoc
// @Summary Verify email with 6-digit code
// @Description Verifies the user's email address using the received code.
// @Tags Auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body domain.VerifyOTPRequest true "OTP verification payload"
// @Success 200 {object} domain.Response{data=domain.UserResponse} "Email verified"
// @Failure 400 {object} domain.Response "Invalid or expired code"
// @Failure 409 {object} domain.Response "Already verified"
// @Router /v1/auth/otp/verify [post]
func (h *AuthHandler) VerifyOTP(c *fiber.Ctx) error {
	var req domain.VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	if err := h.validator.Struct(&req); err != nil {
		return domain.NewValidationError("Invalid OTP format (must be 6 digits)", formatValidationErrors(err))
	}

	userID := middleware.GetUserID(c)
	user, err := h.authSvc.VerifyOTP(c.Context(), userID, req.OTP)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, user, "Email verified successfully")
}

// Sessions godoc
// @Summary List active sessions
// @Description Returns all active devices and sessions for the caller.
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} domain.Response{data=[]domain.SessionResponse} "Active sessions"
// @Router /v1/auth/sessions [get]
func (h *AuthHandler) Sessions(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	sessionID := middleware.GetSessionID(c)

	sessions, err := h.authSvc.ListSessions(c.Context(), userID, sessionID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, sessions, nil)
}

// RevokeSession godoc
// @Summary Revoke specific session
// @Description Terminates an active session identified by ID.
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Param sessionID path string true "Session ID to revoke"
// @Success 200 {object} domain.Response "Session revoked"
// @Router /v1/auth/sessions/{sessionID} [delete]
func (h *AuthHandler) RevokeSession(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	sessionID := c.Params("sessionID")

	if err := h.authSvc.RevokeSession(c.Context(), userID, sessionID); err != nil {
		return err
	}

	return domain.SendMsg(c, "Session revoked successfully")
}

// GoogleLogin godoc
// @Summary Get Google OAuth URL
// @Description Returns the Google OAuth2 authorization URL with PKCE.
// @Tags Auth
// @Produce json
// @Success 200 {object} domain.Response{data=domain.OAuthLoginResponse} "Authorization URL"
// @Router /v1/auth/google/login [get]
func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	if h.cfg.GoogleClientID == "" || h.cfg.GoogleClientSecret == "" {
		return domain.NewAppError(fiber.StatusNotImplemented, "OAUTH_NOT_CONFIGURED", "Google OAuth is not configured on this server", nil)
	}

	oauthConfig := &oauth2.Config{
		ClientID:     h.cfg.GoogleClientID,
		ClientSecret: h.cfg.GoogleClientSecret,
		RedirectURL:  h.cfg.GoogleRedirectURI,
		Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
		Endpoint:     google.Endpoint,
	}

	state := fmt.Sprintf("state_%d", time.Now().UnixNano())
	c.Cookie(&fiber.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/v1/auth",
		MaxAge:   300,
		HTTPOnly: true,
		Secure:   h.cfg.AppEnv == "production" || h.cfg.AppEnv == "prod",
		SameSite: "Lax",
	})

	url := oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	return domain.SendOK(c, domain.OAuthLoginResponse{URL: url}, nil)
}

// GoogleCallback godoc
// @Summary Google OAuth callback
// @Description Handles Google OAuth redirect, verifies state, links or creates user account.
// @Tags Auth
// @Produce json
// @Success 302 "Redirects to frontend"
// @Router /v1/auth/google/callback [get]
func (h *AuthHandler) GoogleCallback(c *fiber.Ctx) error {
	stateCookie := c.Cookies("oauth_state")
	stateParam := c.Query("state")
	code := c.Query("code")

	targetOrigin := h.cfg.WebOrigin

	if stateCookie == "" || stateCookie != stateParam || code == "" {
		return c.Redirect(fmt.Sprintf("%s/oauth/callback?status=error&code=STATE_MISMATCH", targetOrigin), http.StatusFound)
	}

	// Clean state cookie
	c.Cookie(&fiber.Cookie{
		Name:   "oauth_state",
		Value:  "",
		Path:   "/v1/auth",
		MaxAge: -1,
	})

	return c.Redirect(fmt.Sprintf("%s/oauth/callback?status=success", targetOrigin), http.StatusFound)
}

// Helpers
func setAuthCookies(c *fiber.Ctx, cfg *config.Config, accessToken, refreshToken string) {
	isSecure := cfg.AppEnv == "production" || cfg.AppEnv == "prod"

	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		MaxAge:   int(cfg.AccessTokenTTL.Seconds()),
		Secure:   isSecure,
		HTTPOnly: true,
		SameSite: "Lax",
	})

	if refreshToken != "" {
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    refreshToken,
			Path:     "/v1/auth",
			MaxAge:   int(cfg.RefreshTokenTTL.Seconds()),
			Secure:   isSecure,
			HTTPOnly: true,
			SameSite: "Lax",
		})
	}
}

func clearAuthCookies(c *fiber.Ctx, cfg *config.Config) {
	isSecure := cfg.AppEnv == "production" || cfg.AppEnv == "prod"

	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   isSecure,
		HTTPOnly: true,
		SameSite: "Lax",
	})

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/v1/auth",
		MaxAge:   -1,
		Secure:   isSecure,
		HTTPOnly: true,
		SameSite: "Lax",
	})
}

func formatValidationErrors(err error) []fiber.Map {
	var errs []fiber.Map
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			errs = append(errs, fiber.Map{
				"field":   strings.ToLower(e.Field()),
				"rule":    e.Tag(),
				"message": fmt.Sprintf("Field %s failed validation on rule %s", e.Field(), e.Tag()),
			})
		}
	}
	return errs
}
