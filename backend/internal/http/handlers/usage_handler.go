package handlers

import (
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// UsageHandler handles HTTP requests for organization usage accounting and quotas.
type UsageHandler struct {
	usageSvc *service.UsageService
	logger   *slog.Logger
}

// NewUsageHandler initializes a UsageHandler.
func NewUsageHandler(usageSvc *service.UsageService, logger *slog.Logger) *UsageHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &UsageHandler{
		usageSvc: usageSvc,
		logger:   logger,
	}
}

// GetUsage godoc
// @Summary Get organization resource usage
// @Description Fetches resource metrics against plan allowances and daily consumption breakdowns.
// @Tags Usage
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param period query string false "Period preset (current_month, last_month)"
// @Param from query string false "Start date (YYYY-MM-DD)"
// @Param to query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} domain.Response{data=domain.UsageResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/usage [get]
func (h *UsageHandler) GetUsage(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	period := c.Query("period", "current_month")
	fromStr := c.Query("from")
	toStr := c.Query("to")

	resp, err := h.usageSvc.GetUsage(c.Context(), orgID, period, fromStr, toStr)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}
