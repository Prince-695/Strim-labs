package handlers

import (
	"context"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// SystemHandler provides endpoints for system health introspection.
type SystemHandler struct {
	systemService service.SystemService
}

// NewSystemHandler creates a new SystemHandler with the given SystemService dependency.
func NewSystemHandler(systemService service.SystemService) *SystemHandler {
	return &SystemHandler{
		systemService: systemService,
	}
}

// Health godoc
// @Summary System Health
// @Description Checks if the server is healthy and accepting requests.
// @Tags System
// @Produce json
// @Success 200 {object} domain.Response{data=map[string]string} "System health status"
// @Failure 503 {object} domain.Response "Service dependencies degraded"
// @Router /health [get]
func (h *SystemHandler) Health(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 3*time.Second)
	defer cancel()

	status, err := h.systemService.CheckHealth(ctx)
	if err != nil {
		return domain.NewServiceUnavailableError("Service dependencies degraded", err)
	}

	return domain.SendOK(c, status, nil)
}
