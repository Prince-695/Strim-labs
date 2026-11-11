package middleware

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

const (
	LocalsCurrentOrgID = "currentOrgID"
	LocalsUserRole     = "userRole"
)

// ResolveTenant extracts :orgID, resolves caller's membership via 60s cache or DB,
// and enforces zero-enumeration: non-members receive 404 NOT_FOUND.
func ResolveTenant(orgSvc service.OrgService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		orgID := strings.TrimSpace(c.Params("orgID"))
		if orgID == "" {
			return c.Next()
		}

		userID := GetUserID(c)
		if userID == "" {
			return domain.NewUnauthorizedError("Authentication required")
		}

		role, err := orgSvc.ResolveUserRole(c.Context(), orgID, userID)
		if err != nil {
			// Zero-enumeration: Always return 404 NOT_FOUND for non-members
			return domain.NewNotFoundError("Organization not found")
		}

		c.Locals(LocalsCurrentOrgID, orgID)
		c.Locals(LocalsUserRole, role)

		return c.Next()
	}
}

// GetCurrentOrgID retrieves the resolved orgID from context.
func GetCurrentOrgID(c *fiber.Ctx) string {
	if val, ok := c.Locals(LocalsCurrentOrgID).(string); ok {
		return val
	}
	return ""
}

// GetUserRole retrieves the resolved user role in current organization.
func GetUserRole(c *fiber.Ctx) domain.OrgRole {
	if val, ok := c.Locals(LocalsUserRole).(domain.OrgRole); ok {
		return val
	}
	return ""
}
