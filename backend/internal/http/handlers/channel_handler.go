package handlers

import (
	"log/slog"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// ChannelHandler handles HTTP requests for notification channel management and test verification.
type ChannelHandler struct {
	channelSvc service.NotificationService
	logger     *slog.Logger
}

// NewChannelHandler creates a new ChannelHandler.
func NewChannelHandler(channelSvc service.NotificationService, logger *slog.Logger) *ChannelHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &ChannelHandler{
		channelSvc: channelSvc,
		logger:     logger,
	}
}

// CreateChannel godoc
// @Summary Create notification channel
// @Description Creates an outbound alerting destination (Slack, Email, Webhook). Secrets are write-only.
// @Tags Channels
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.CreateChannelRequest true "Channel Parameters"
// @Success 201 {object} domain.Response{data=domain.ChannelResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/notification-channels [post]
func (h *ChannelHandler) CreateChannel(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	var req domain.CreateChannelRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	if strings.TrimSpace(req.Name) == "" || len(req.Name) < 2 || len(req.Name) > 128 {
		return domain.NewValidationError("channel name must be between 2 and 128 characters", nil)
	}

	ch, err := h.channelSvc.CreateChannel(c.Context(), projectID, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusCreated, ch, nil, "Notification channel created successfully")
}

// GetChannel godoc
// @Summary Get notification channel details
// @Description Returns channel details with write-only secrets masked as '***'.
// @Tags Channels
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param channelID path string true "Channel ID"
// @Success 200 {object} domain.Response{data=domain.ChannelResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Channel not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/notification-channels/{channelID} [get]
func (h *ChannelHandler) GetChannel(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	channelID := c.Params("channelID")

	ch, err := h.channelSvc.GetChannel(c.Context(), projectID, channelID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, ch, nil, "Notification channel retrieved successfully")
}

// UpdateChannel godoc
// @Summary Update notification channel
// @Description Modifies name, enabled state, or destination configuration.
// @Tags Channels
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param channelID path string true "Channel ID"
// @Param request body domain.UpdateChannelRequest true "Channel Updates"
// @Success 200 {object} domain.Response{data=domain.ChannelResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Channel not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/notification-channels/{channelID} [put]
func (h *ChannelHandler) UpdateChannel(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	channelID := c.Params("channelID")

	var req domain.UpdateChannelRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	ch, err := h.channelSvc.UpdateChannel(c.Context(), projectID, channelID, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, ch, nil, "Notification channel updated successfully")
}

// DeleteChannel godoc
// @Summary Delete notification channel
// @Description Removes an outbound alerting channel.
// @Tags Channels
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param channelID path string true "Channel ID"
// @Success 200 {object} domain.Response
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Channel not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/notification-channels/{channelID} [delete]
func (h *ChannelHandler) DeleteChannel(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	channelID := c.Params("channelID")

	if err := h.channelSvc.DeleteChannel(c.Context(), projectID, channelID); err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, nil, nil, "Notification channel deleted successfully")
}

// ListChannels godoc
// @Summary List notification channels
// @Description Returns all notification channels configured for the project with write-only secrets masked.
// @Tags Channels
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=domain.ListChannelsResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/notification-channels [get]
func (h *ChannelHandler) ListChannels(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	resp, err := h.channelSvc.ListChannels(c.Context(), projectID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Notification channels retrieved successfully")
}

// TestChannel godoc
// @Summary Test dispatch to notification channel
// @Description Sends a synthetic test message to verify external channel connectivity.
// @Tags Channels
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param channelID path string true "Channel ID"
// @Success 200 {object} domain.Response{data=domain.TestChannelResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Channel not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/notification-channels/{channelID}/test [post]
func (h *ChannelHandler) TestChannel(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	channelID := c.Params("channelID")

	resp, err := h.channelSvc.TestChannel(c.Context(), projectID, channelID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Test notification processed")
}
