package handlers

import (
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// AlertHandler handles HTTP requests for alert rule management.
type AlertHandler struct {
	alertSvc service.AlertService
	logger   *slog.Logger
}

// NewAlertHandler creates a new AlertHandler.
func NewAlertHandler(alertSvc service.AlertService, logger *slog.Logger) *AlertHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &AlertHandler{
		alertSvc: alertSvc,
		logger:   logger,
	}
}

// CreateRule godoc
// @Summary Create an alert rule
// @Description Defines a metric threshold alert policy with condition window, hysteresis duration, and notification channels.
// @Tags Alerts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.CreateAlertRuleRequest true "Alert Rule Parameters"
// @Success 201 {object} domain.Response{data=domain.AlertRuleResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/alert-rules [post]
func (h *AlertHandler) CreateRule(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	var req domain.CreateAlertRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	if req.Name == "" || len(req.Name) < 2 || len(req.Name) > 128 {
		return domain.NewValidationError("rule name must be between 2 and 128 characters", nil)
	}

	rule, err := h.alertSvc.CreateRule(c.Context(), projectID, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusCreated, rule, nil, "Alert rule created successfully")
}

// GetRule godoc
// @Summary Get alert rule details
// @Description Retrieves full configuration and current state of a specific alert rule.
// @Tags Alerts
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param ruleID path string true "Alert Rule ID"
// @Success 200 {object} domain.Response{data=domain.AlertRuleResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Alert rule not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/alert-rules/{ruleID} [get]
func (h *AlertHandler) GetRule(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	ruleID := c.Params("ruleID")

	rule, err := h.alertSvc.GetRule(c.Context(), projectID, ruleID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, rule, nil, "Alert rule retrieved successfully")
}

// UpdateRule godoc
// @Summary Update an alert rule
// @Description Updates rule configuration using optimistic concurrency control (must supply current version).
// @Tags Alerts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param ruleID path string true "Alert Rule ID"
// @Param request body domain.UpdateAlertRuleRequest true "Alert Rule Updates"
// @Success 200 {object} domain.Response{data=domain.AlertRuleResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Alert rule not found"
// @Failure 409 {object} domain.Response "Version conflict"
// @Router /v1/organizations/{orgID}/projects/{projectID}/alert-rules/{ruleID} [put]
func (h *AlertHandler) UpdateRule(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	ruleID := c.Params("ruleID")

	var req domain.UpdateAlertRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	if req.Version <= 0 {
		return domain.NewValidationError("version is required and must be >= 1 for optimistic concurrency", nil)
	}

	rule, err := h.alertSvc.UpdateRule(c.Context(), projectID, ruleID, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, rule, nil, "Alert rule updated successfully")
}

// DeleteRule godoc
// @Summary Delete an alert rule
// @Description Removes an alert policy permanently.
// @Tags Alerts
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param ruleID path string true "Alert Rule ID"
// @Success 200 {object} domain.Response
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Alert rule not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/alert-rules/{ruleID} [delete]
func (h *AlertHandler) DeleteRule(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	ruleID := c.Params("ruleID")

	if err := h.alertSvc.DeleteRule(c.Context(), projectID, ruleID); err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, nil, nil, "Alert rule deleted successfully")
}

// MuteRule godoc
// @Summary Mute an alert rule
// @Description Temporarily disables alert firing and incident opening for a specified duration in minutes.
// @Tags Alerts
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param ruleID path string true "Alert Rule ID"
// @Param request body domain.MuteAlertRuleRequest true "Mute Parameters"
// @Success 200 {object} domain.Response{data=domain.AlertRuleResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Alert rule not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/alert-rules/{ruleID}/mute [post]
func (h *AlertHandler) MuteRule(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	ruleID := c.Params("ruleID")

	var req domain.MuteAlertRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	if req.Minutes < 1 || req.Minutes > 10080 {
		return domain.NewValidationError("minutes must be between 1 and 10080", nil)
	}

	rule, err := h.alertSvc.MuteRule(c.Context(), projectID, ruleID, req.Minutes)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, rule, nil, "Alert rule muted successfully")
}

// ListRules godoc
// @Summary List alert rules for project
// @Description Returns all alerting policies configured for the specified project.
// @Tags Alerts
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=domain.ListAlertRulesResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/alert-rules [get]
func (h *AlertHandler) ListRules(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	resp, err := h.alertSvc.ListRules(c.Context(), projectID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Alert rules retrieved successfully")
}
