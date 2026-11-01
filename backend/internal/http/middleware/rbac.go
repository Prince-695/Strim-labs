package middleware

import (
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// RequireRole ensures that the authenticated member has at least the specified minimum role in the tenant.
// Hierarchy: viewer (1) < member (2) < admin (3) < owner (4)
func RequireRole(minRole domain.OrgRole) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := GetUserRole(c)
		if role == "" || !role.AtLeast(minRole) {
			return domain.NewForbiddenError(domain.ErrCodeForbiddenRole, "You do not have sufficient permissions to perform this action")
		}
		return c.Next()
	}
}
