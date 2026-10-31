package middleware

import (
	"crypto/subtle"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/basicauth"
)

// SwaggerBasicAuth protects the Swagger documentation UI using HTTP Basic Auth.
func SwaggerBasicAuth(cfg *config.Config) fiber.Handler {
	return basicauth.New(basicauth.Config{
		Users: map[string]string{
			cfg.SwaggerUser: cfg.SwaggerPassword,
		},
		Realm: "STRIM Labs API Documentation",
		Authorizer: func(user, pass string) bool {
			userMatch := subtle.ConstantTimeCompare([]byte(user), []byte(cfg.SwaggerUser)) == 1
			passMatch := subtle.ConstantTimeCompare([]byte(pass), []byte(cfg.SwaggerPassword)) == 1
			return userMatch && passMatch
		},
		Unauthorized: func(c *fiber.Ctx) error {
			c.Set("WWW-Authenticate", `Basic realm="STRIM Labs API Documentation"`)
			return domain.SendError(c, fiber.StatusUnauthorized, domain.ErrCodeUnauthorized, "Invalid documentation credentials", nil)
		},
	})
}
