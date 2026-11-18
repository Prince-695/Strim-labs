package middleware

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/config"
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

// SetAuthCookies writes access_token, strim_access_token, and refresh_token cookies to the response.
// Both access and refresh cookies use Path: "/" to ensure browsers transmit them across all API endpoints.
func SetAuthCookies(c *fiber.Ctx, cfg *config.Config, accessToken, refreshToken string) {
	isSecure := cfg.AppEnv == "production" || cfg.AppEnv == "prod"
	sameSite := "Lax"
	if isSecure {
		sameSite = "None"
	}

	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		MaxAge:   int(cfg.RefreshTokenExpiry.Seconds()),
		Secure:   isSecure,
		HTTPOnly: true,
		SameSite: sameSite,
	})

	c.Cookie(&fiber.Cookie{
		Name:     "strim_access_token",
		Value:    accessToken,
		Path:     "/",
		MaxAge:   int(cfg.RefreshTokenExpiry.Seconds()),
		Secure:   isSecure,
		HTTPOnly: false,
		SameSite: sameSite,
	})

	if refreshToken != "" {
		c.Cookie(&fiber.Cookie{
			Name:     "refresh_token",
			Value:    refreshToken,
			Path:     "/",
			MaxAge:   int(cfg.RefreshTokenExpiry.Seconds()),
			Secure:   isSecure,
			HTTPOnly: true,
			SameSite: sameSite,
		})
	}
}

// ClearAuthCookies wipes all auth cookies on the client.
func ClearAuthCookies(c *fiber.Ctx, cfg *config.Config) {
	isSecure := cfg.AppEnv == "production" || cfg.AppEnv == "prod"
	sameSite := "Lax"
	if isSecure {
		sameSite = "None"
	}

	c.Cookie(&fiber.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   isSecure,
		HTTPOnly: true,
		SameSite: sameSite,
	})

	c.Cookie(&fiber.Cookie{
		Name:     "strim_access_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   isSecure,
		HTTPOnly: false,
		SameSite: sameSite,
	})

	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   isSecure,
		HTTPOnly: true,
		SameSite: sameSite,
	})
}

// RequireAuth validates the JWT access token, checks JTI denylist, auto-refreshes expired sessions via refresh token cookie, and sets user context.
func RequireAuth(authSvc service.AuthService, cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tokenStr, authType := ExtractToken(c)

		var claims *crypto.JWTClaims
		var err error

		if tokenStr != "" {
			claims, err = crypto.ValidateAccessToken(tokenStr, cfg.JWTSecret)
			if err == nil {
				// Check if token JTI has been revoked via logout or rotation
				if authSvc.IsTokenRevoked(claims.ID) {
					err = domain.NewTokenExpiredError()
				} else if claims.IssuedAt != nil && authSvc.IsUserRevoked(claims.Subject, claims.IssuedAt.Time) {
					err = domain.NewTokenExpiredError()
				}
			}
		}

		// Fast path: access token is present, valid signature, unexpired, and unrevoked
		if tokenStr != "" && err == nil && claims != nil {
			c.Locals(LocalsUserID, claims.Subject)
			c.Locals(LocalsSessionID, claims.SessionID)
			c.Locals(LocalsUserEmail, claims.Email)
			c.Locals(LocalsIsVerified, claims.IsVerified)
			c.Locals(LocalsClaims, claims)
			c.Locals(LocalsAuthType, authType)
			return c.Next()
		}

		// If the client sent an expired Bearer token, check if a valid access_token cookie exists
		if tokenStr != "" && authType == "bearer" {
			cookieToken := c.Cookies("access_token")
			if cookieToken == "" {
				cookieToken = c.Cookies("strim_access_token")
			}
			if cookieToken != "" && cookieToken != tokenStr {
				cookieClaims, cookieErr := crypto.ValidateAccessToken(cookieToken, cfg.JWTSecret)
				if cookieErr == nil && !authSvc.IsTokenRevoked(cookieClaims.ID) {
					c.Locals(LocalsUserID, cookieClaims.Subject)
					c.Locals(LocalsSessionID, cookieClaims.SessionID)
					c.Locals(LocalsUserEmail, cookieClaims.Email)
					c.Locals(LocalsIsVerified, cookieClaims.IsVerified)
					c.Locals(LocalsClaims, cookieClaims)
					c.Locals(LocalsAuthType, "cookie")
					return c.Next()
				}
			}
		}

		// Auto-refresh path: access token is expired, missing, or revoked.
		// Inspect refresh_token cookie (or header) to silently rotate tokens without logging out the active user.
		refreshToken := c.Cookies("refresh_token")
		if refreshToken == "" {
			refreshToken = strings.TrimSpace(c.Get("X-Refresh-Token"))
		}

		if refreshToken != "" {
			userAgent := c.Get("User-Agent")
			clientIP := c.IP()

			user, newAccessToken, newRefreshToken, refreshErr := authSvc.Refresh(c.Context(), refreshToken, userAgent, clientIP)
			if refreshErr == nil && newAccessToken != "" {
				// 1. Set updated cookies on response with renewed 7-day TTL deadline
				SetAuthCookies(c, cfg, newAccessToken, newRefreshToken)

				// 2. Expose the new access token in headers so frontend interceptors can update storage
				c.Set("X-Access-Token", newAccessToken)
				c.Set("Access-Control-Expose-Headers", "X-Access-Token")

				// 3. Populate request context with new claims so this request succeeds immediately
				newClaims, valErr := crypto.ValidateAccessToken(newAccessToken, cfg.JWTSecret)
				if valErr == nil && newClaims != nil {
					c.Locals(LocalsUserID, newClaims.Subject)
					c.Locals(LocalsSessionID, newClaims.SessionID)
					c.Locals(LocalsUserEmail, newClaims.Email)
					c.Locals(LocalsIsVerified, newClaims.IsVerified)
					c.Locals(LocalsClaims, newClaims)
					c.Locals(LocalsAuthType, "cookie")
					if user != nil {
						c.Locals(LocalsUserEmail, user.Email)
						c.Locals(LocalsIsVerified, user.IsVerified)
					}
					return c.Next()
				}
			}

			// If refresh failed (e.g. refresh token expired > 7 days or revoked), clear stale cookies
			ClearAuthCookies(c, cfg)
		}

		if tokenStr == "" && refreshToken == "" {
			return domain.NewUnauthorizedError("Authentication required. Please provide a valid Bearer token or session cookie")
		}

		return domain.NewTokenExpiredError()
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
