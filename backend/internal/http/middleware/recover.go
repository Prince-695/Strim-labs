package middleware

import (
	"fmt"
	"log/slog"
	"runtime/debug"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// Recover catches any unexpected panics in handlers, logs stack traces, and returns a 500 envelope.
func Recover(l *slog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) (err error) {
		defer func() {
			if r := recover(); r != nil {
				stack := string(debug.Stack())
				reqID := domain.GetRequestID(c)

				l.Error("Panic recovered in HTTP handler",
					slog.String("request_id", reqID),
					slog.String("method", c.Method()),
					slog.String("path", c.Path()),
					slog.Any("panic", r),
					slog.String("stack", stack),
				)

				err = domain.NewInternalError(fmt.Errorf("panic: %v", r))
			}
		}()

		return c.Next()
	}
}
