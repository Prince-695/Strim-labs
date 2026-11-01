package middleware

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// CSRFProtection enforces Origin matching for cookie-authenticated mutating requests.
func CSRFProtection(cfg *config.Config) fiber.Handler {
	allowedMap := make(map[string]struct{})
	for _, origin := range cfg.AllowedOrigins {
		allowedMap[strings.ToLower(strings.TrimRight(origin, "/"))] = struct{}{}
	}

	return func(c *fiber.Ctx) error {
		// Only inspect mutating methods
		method := c.Method()
		if method == fiber.MethodGet || method == fiber.MethodHead || method == fiber.MethodOptions {
			return c.Next()
		}

		// Only inspect if authenticated via Cookie (Bearer tokens are exempt from CSRF)
		authType, ok := c.Locals(LocalsAuthType).(string)
		if !ok || authType != "cookie" {
			return c.Next()
		}

		origin := c.Get("Origin")
		if origin == "" {
			// Fallback to Referer host if Origin is omitted
			origin = c.Get("Referer")
		}

		if origin == "" {
			return domain.NewForbiddenError("CSRF_VIOLATION", "Origin header required for cookie-authenticated requests")
		}

		normalized := strings.ToLower(strings.TrimRight(origin, "/"))
		// Check prefix or exact match
		matched := false
		for allowed := range allowedMap {
			if strings.HasPrefix(normalized, allowed) {
				matched = true
				break
			}
		}

		if !matched {
			return domain.NewForbiddenError("CSRF_VIOLATION", "Cross-site request blocked: untrusted Origin")
		}

		return c.Next()
	}
}
