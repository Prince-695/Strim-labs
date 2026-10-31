package http

import (
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/swagger"

	_ "github.com/Prince-695/strim/backend/docs"
)

// NewRouter constructs and configures the Fiber application with middlewares and routes.
func NewRouter(
	cfg *config.Config,
	handlers *handlers.Container,
	logger *slog.Logger,
	idGen ids.IDGenerator,
) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:               "STRIM Labs API",
		BodyLimit:             cfg.BodyLimitBytes,
		ErrorHandler:          domain.CentralErrorHandler(logger),
		DisableStartupMessage: true,
		StrictRouting:         false,
		CaseSensitive:         true,
	})

	// Global Middlewares Pipeline
	app.Use(middleware.RequestID(idGen))
	app.Use(middleware.Recover(logger))
	app.Use(middleware.HTTPLogger(logger))
	app.Use(middleware.SecurityHeaders(cfg))
	app.Use(middleware.CORSConfig(cfg))
	app.Use(middleware.Timeout(cfg.RequestTimeout))

	// Root endpoint for platform probes and basic service status
	app.Get("/", func(c *fiber.Ctx) error {
		return domain.SendOK(c, fiber.Map{
			"name":   "STRIM Labs API",
			"status": "healthy",
			"docs":   "/swagger/index.html",
		}, nil)
	})
	app.Head("/", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	// System Health Route
	app.Get("/health", handlers.System.Health)

	// Swagger Documentation (Protected by HTTP Basic Auth)
	swaggerGroup := app.Group("/swagger")
	swaggerGroup.Use(middleware.SwaggerBasicAuth(cfg))
	swaggerGroup.Get("/*", swagger.HandlerDefault)

	// Catch-all 404 handler returning standard Response envelope
	app.Use(func(c *fiber.Ctx) error {
		return domain.SendError(
			c,
			fiber.StatusNotFound,
			domain.ErrCodeNotFound,
			"The requested resource was not found",
			fiber.Map{
				"path":   c.Path(),
				"method": c.Method(),
			},
		)
	})

	return app
}
