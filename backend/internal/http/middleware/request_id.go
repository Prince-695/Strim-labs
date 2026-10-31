package middleware

import (
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/logger"
	"github.com/gofiber/fiber/v2"
)

const HeaderXRequestID = "X-Request-ID"

// RequestID returns middleware that ensures every HTTP request has an X-Request-ID header and context tracking.
func RequestID(idGen ids.IDGenerator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		c.Locals("startTime", start)

		reqID := strings.TrimSpace(c.Get(HeaderXRequestID))
		if reqID == "" {
			reqID = "req_" + idGen.MustNewUUIDv7()
		}

		c.Locals("requestID", reqID)
		c.Set(HeaderXRequestID, reqID)

		// Inject into Go context for standard logger propagation
		ctx := logger.WithRequestID(c.UserContext(), reqID)
		c.SetUserContext(ctx)

		return c.Next()
	}
}
