package handlers

import (
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// WebhookHandler handles HTTP endpoints for outbound webhook management.
type WebhookHandler struct {
	webhookSvc *service.WebhookService
	logger     *slog.Logger
}

// NewWebhookHandler initializes a WebhookHandler.
func NewWebhookHandler(webhookSvc *service.WebhookService, logger *slog.Logger) *WebhookHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &WebhookHandler{
		webhookSvc: webhookSvc,
		logger:     logger,
	}
}

// CreateWebhook godoc
// @Summary Create outbound webhook
// @Description Subscribes an HTTPS URL to system event notifications with HMAC-SHA256 signature verification.
// @Tags Webhooks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.CreateWebhookRequest true "Webhook Parameters"
// @Success 201 {object} domain.Response{data=domain.WebhookResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/webhooks [post]
func (h *WebhookHandler) CreateWebhook(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")

	var req domain.CreateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	ctx := audit.WithAuditContext(
		c.Context(),
		middleware.GetUserID(c),
		middleware.GetUserEmail(c),
		c.IP(),
		c.Get("User-Agent"),
	)

	resp, err := h.webhookSvc.CreateWebhook(ctx, orgID, projectID, &req)
	if err != nil {
		return err
	}

	return domain.SendCreated(c, resp)
}

// ListWebhooks godoc
// @Summary List project webhooks
// @Description Returns all outbound webhooks configured for a project (secrets masked as '***').
// @Tags Webhooks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=[]domain.WebhookResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/webhooks [get]
func (h *WebhookHandler) ListWebhooks(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")

	hooks, err := h.webhookSvc.ListWebhooks(c.Context(), orgID, projectID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, hooks, nil)
}

// UpdateWebhook godoc
// @Summary Update project webhook
// @Description Modifies an existing webhook's URL, subscribed event triggers, or active status.
// @Tags Webhooks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param webhookID path string true "Webhook ID"
// @Param request body domain.UpdateWebhookRequest true "Update Parameters"
// @Success 200 {object} domain.Response{data=domain.WebhookResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/webhooks/{webhookID} [put]
func (h *WebhookHandler) UpdateWebhook(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	webhookID := c.Params("webhookID")

	var req domain.UpdateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	ctx := audit.WithAuditContext(
		c.Context(),
		middleware.GetUserID(c),
		middleware.GetUserEmail(c),
		c.IP(),
		c.Get("User-Agent"),
	)

	resp, err := h.webhookSvc.UpdateWebhook(ctx, orgID, projectID, webhookID, &req)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// DeleteWebhook godoc
// @Summary Delete project webhook
// @Description Permanently removes an outbound webhook registration.
// @Tags Webhooks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param webhookID path string true "Webhook ID"
// @Success 200 {object} domain.Response{data=map[string]interface{}}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/webhooks/{webhookID} [delete]
func (h *WebhookHandler) DeleteWebhook(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	webhookID := c.Params("webhookID")

	ctx := audit.WithAuditContext(
		c.Context(),
		middleware.GetUserID(c),
		middleware.GetUserEmail(c),
		c.IP(),
		c.Get("User-Agent"),
	)

	if err := h.webhookSvc.DeleteWebhook(ctx, orgID, projectID, webhookID); err != nil {
		return err
	}

	return domain.SendOK(c, fiber.Map{
		"message": "Webhook deleted successfully",
	}, nil)
}

// ListDeliveries godoc
// @Summary List webhook deliveries
// @Description Returns recent outbound delivery attempts, status codes, and execution latencies for a webhook.
// @Tags Webhooks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param webhookID path string true "Webhook ID"
// @Param status query string false "Delivery status filter (success, failed, pending)"
// @Param limit query int false "Page size (default 20, max 100)"
// @Param cursor query string false "Pagination cursor (RFC3339 timestamp)"
// @Success 200 {object} domain.Response{data=[]domain.WebhookDeliveryResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/webhooks/{webhookID}/deliveries [get]
func (h *WebhookHandler) ListDeliveries(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	webhookID := c.Params("webhookID")

	status := c.Query("status")
	limit := c.QueryInt("limit", 20)
	cursor := c.Query("cursor")

	deliveries, err := h.webhookSvc.ListDeliveries(c.Context(), orgID, projectID, webhookID, status, limit, cursor)
	if err != nil {
		return err
	}

	return domain.SendOK(c, deliveries, nil)
}

// Redeliver godoc
// @Summary Redeliver webhook
// @Description Re-triggers immediate execution of a previous outbound delivery attempt.
// @Tags Webhooks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param webhookID path string true "Webhook ID"
// @Param deliveryID path string true "Delivery ID"
// @Success 200 {object} domain.Response{data=domain.WebhookDeliveryResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/webhooks/{webhookID}/deliveries/{deliveryID}/redeliver [post]
func (h *WebhookHandler) Redeliver(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	webhookID := c.Params("webhookID")
	deliveryID := c.Params("deliveryID")

	resp, err := h.webhookSvc.Redeliver(c.Context(), orgID, projectID, webhookID, deliveryID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}
