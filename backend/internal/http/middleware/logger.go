package middleware

import (
	"log/slog"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// HTTPLogger logs every incoming HTTP request and its execution metrics with slog.
func HTTPLogger(l *slog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		path := c.Path()

		err := c.Next()

		latency := time.Since(start)
		status := c.Response().StatusCode()
		reqID := domain.GetRequestID(c)

		attrs := []slog.Attr{
			slog.String("request_id", reqID),
			slog.String("method", c.Method()),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("latency", latency),
			slog.String("ip", c.IP()),
			slog.String("user_agent", c.Get("User-Agent")),
		}

		// Quiet down routine platform probes
		if (path == "/" || path == "/health" || path == "/favicon.ico") && status < 500 {
			l.LogAttrs(c.UserContext(), slog.LevelDebug, "HTTP request", attrs...)
			return err
		}

		if status >= 500 {
			l.LogAttrs(c.UserContext(), slog.LevelError, "HTTP server error", attrs...)
		} else {
			// Routine requests and client warnings are kept at Debug level to prevent console noise
			l.LogAttrs(c.UserContext(), slog.LevelDebug, "HTTP request completed", attrs...)
		}

		return err
	}
}
