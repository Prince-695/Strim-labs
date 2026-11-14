package handlers

import (
	"log/slog"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// AuditHandler handles HTTP requests for querying immutable audit logs.
type AuditHandler struct {
	auditSvc *service.AuditService
	logger   *slog.Logger
}

// NewAuditHandler initializes an AuditHandler.
func NewAuditHandler(auditSvc *service.AuditService, logger *slog.Logger) *AuditHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &AuditHandler{
		auditSvc: auditSvc,
		logger:   logger,
	}
}

// ListAuditLogs godoc
// @Summary List organization audit logs
// @Description Queries append-only audit records with filtering on actor, action, resource type, and time bounds.
// @Tags AuditLogs
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param actor_id query string false "Filter by actor user ID"
// @Param action query string false "Filter by action verb (e.g. member.role_changed)"
// @Param resource_type query string false "Filter by resource type (e.g. member, project)"
// @Param from query string false "RFC3339 start timestamp"
// @Param to query string false "RFC3339 end timestamp"
// @Param limit query int false "Page size (default 20, max 100)"
// @Param cursor query string false "Pagination cursor (RFC3339 timestamp)"
// @Success 200 {object} domain.Response{data=[]domain.AuditLogResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/audit-logs [get]
func (h *AuditHandler) ListAuditLogs(c *fiber.Ctx) error {
	orgID := c.Params("orgID")

	filter := domain.AuditLogFilter{
		OrgID:        orgID,
		ActorID:      c.Query("actor_id"),
		Action:       c.Query("action"),
		ResourceType: c.Query("resource_type"),
		Limit:        c.QueryInt("limit", 20),
		Cursor:       c.Query("cursor"),
	}

	if fromStr := c.Query("from"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			filter.From = &t
		}
	}
	if toStr := c.Query("to"); toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			filter.To = &t
		}
	}

	logs, err := h.auditSvc.ListAuditLogs(c.Context(), orgID, filter)
	if err != nil {
		return err
	}

	return domain.SendOK(c, logs, nil)
}
