package middleware

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

// SecurityHeaders applies OWASP recommended security headers to all responses.
func SecurityHeaders(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;")

		if cfg.AppEnv == "production" {
			c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		return c.Next()
	}
}

// CORSConfig builds a Fiber CORS middleware configured with the project's allowed origins.
func CORSConfig(cfg *config.Config) fiber.Handler {
	origins := strings.Join(cfg.AllowedOrigins, ", ")
	if origins == "" {
		origins = "http://localhost:3000"
	}

	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID,X-API-Key,Idempotency-Key",
		AllowCredentials: true,
		ExposeHeaders:    "X-Request-ID,X-RateLimit-Limit,X-RateLimit-Remaining,Retry-After",
		MaxAge:           86400, // 24 hours preflight cache
	})
}
