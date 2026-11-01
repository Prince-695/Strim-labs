package middleware

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

const (
	LocalsUserID     = "userID"
	LocalsSessionID  = "sessionID"
	LocalsUserEmail  = "userEmail"
	LocalsIsVerified = "isVerified"
	LocalsClaims     = "claims"
	LocalsAuthType   = "authType" // "bearer" or "cookie"
)

// ExtractToken retrieves JWT from Bearer header or access_token cookie.
// Per API specs Section 1.1: If Referer is Swagger, cookie fallback is bypassed.
func ExtractToken(c *fiber.Ctx) (string, string) {
	// 1. Check Bearer Authorization header
	authHeader := c.Get(fiber.HeaderAuthorization)
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1]), "bearer"
		}
	}

	// 2. Swagger Referer guard
	referer := c.Get("Referer")
	if strings.Contains(referer, "/swagger/") {
		return "", ""
	}

	// 3. Fallback to HttpOnly cookie
	cookieToken := c.Cookies("access_token")
	if cookieToken != "" {
		return strings.TrimSpace(cookieToken), "cookie"
	}

	return "", ""
}

// RequireAuth validates the JWT access token, checks JTI denylist, and sets user context.
func RequireAuth(authSvc service.AuthService, secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tokenStr, authType := ExtractToken(c)
		if tokenStr == "" {
			return domain.NewUnauthorizedError("Authentication required. Please provide a valid Bearer token or session cookie")
		}

		claims, err := crypto.ValidateAccessToken(tokenStr, secret)
		if err != nil {
			if err == crypto.ErrExpiredToken {
				return domain.NewTokenExpiredError()
			}
			return domain.NewAppError(fiber.StatusUnauthorized, domain.ErrCodeTokenInvalid, "Invalid authentication token", err)
		}

		// Check if token JTI has been revoked via logout or rotation
		if authSvc.IsTokenRevoked(claims.ID) {
			return domain.NewTokenExpiredError()
		}

		// Check if user was globally revoked (e.g. password reset / change)
		if claims.IssuedAt != nil && authSvc.IsUserRevoked(claims.Subject, claims.IssuedAt.Time) {
			return domain.NewTokenExpiredError()
		}

		c.Locals(LocalsUserID, claims.Subject)
		c.Locals(LocalsSessionID, claims.SessionID)
		c.Locals(LocalsUserEmail, claims.Email)
		c.Locals(LocalsIsVerified, claims.IsVerified)
		c.Locals(LocalsClaims, claims)
		c.Locals(LocalsAuthType, authType)

		return c.Next()
	}
}

// RequireVerified blocks unverified users from accessing protected tenant and project features.
func RequireVerified() fiber.Handler {
	return func(c *fiber.Ctx) error {
		isVerified, ok := c.Locals(LocalsIsVerified).(bool)
		if !ok || !isVerified {
			return domain.NewEmailNotVerifiedError()
		}
		return c.Next()
	}
}

// Context helpers
func GetUserID(c *fiber.Ctx) string {
	if val, ok := c.Locals(LocalsUserID).(string); ok {
		return val
	}
	return ""
}

func GetSessionID(c *fiber.Ctx) string {
	if val, ok := c.Locals(LocalsSessionID).(string); ok {
		return val
	}
	return ""
}

func GetUserEmail(c *fiber.Ctx) string {
	if val, ok := c.Locals(LocalsUserEmail).(string); ok {
		return val
	}
	return ""
}
