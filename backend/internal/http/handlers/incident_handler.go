package handlers

import (
	"log/slog"
	"strconv"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// IncidentHandler handles HTTP requests for incident management and timeline interactions.
type IncidentHandler struct {
	incidentSvc service.IncidentService
	logger      *slog.Logger
}

// NewIncidentHandler creates a new IncidentHandler.
func NewIncidentHandler(incidentSvc service.IncidentService, logger *slog.Logger) *IncidentHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &IncidentHandler{
		incidentSvc: incidentSvc,
		logger:      logger,
	}
}

// ListIncidents godoc
// @Summary List incidents for project
// @Description Returns paginated incidents with filtering by status, severity, and time range.
// @Tags Incidents
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param status query string false "Filter by status (open, acknowledged, resolved, all)" default(all)
// @Param severity query string false "Filter by severity (critical, warning, info)"
// @Param range query string false "Filter by time window (15m, 1h, 6h, 24h, 7d, 30d)" default(24h)
// @Param limit query int false "Max incidents to return (1-100)" default(20)
// @Param offset query int false "Pagination offset" default(0)
// @Success 200 {object} domain.Response{data=domain.ListIncidentsResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/incidents [get]
func (h *IncidentHandler) ListIncidents(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))

	query := domain.ListIncidentsQuery{
		Status:   c.Query("status", "all"),
		Severity: c.Query("severity"),
		Range:    c.Query("range", "24h"),
		Limit:    limit,
		Offset:   offset,
	}

	resp, err := h.incidentSvc.ListIncidents(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Incidents retrieved successfully")
}

// GetIncident godoc
// @Summary Get incident details with timeline
// @Description Returns single incident details including full chronological audit event timeline.
// @Tags Incidents
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param incidentID path string true "Incident ID"
// @Success 200 {object} domain.Response{data=domain.IncidentDetailResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Incident not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/incidents/{incidentID} [get]
func (h *IncidentHandler) GetIncident(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	incidentID := c.Params("incidentID")

	resp, err := h.incidentSvc.GetIncident(c.Context(), projectID, incidentID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Incident details retrieved successfully")
}

// AcknowledgeIncident godoc
// @Summary Acknowledge an incident
// @Description Marks an open incident as acknowledged by the current user.
// @Tags Incidents
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param incidentID path string true "Incident ID"
// @Success 200 {object} domain.Response{data=domain.IncidentDetailResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Incident not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/incidents/{incidentID}/acknowledge [post]
func (h *IncidentHandler) AcknowledgeIncident(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	incidentID := c.Params("incidentID")
	userEmail := middleware.GetUserEmail(c)
	if userEmail == "" {
		userEmail = middleware.GetUserID(c)
	}

	resp, err := h.incidentSvc.AcknowledgeIncident(c.Context(), projectID, incidentID, userEmail)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Incident acknowledged successfully")
}

// ResolveIncident godoc
// @Summary Manually resolve an incident
// @Description Marks an active incident as manually resolved.
// @Tags Incidents
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param incidentID path string true "Incident ID"
// @Success 200 {object} domain.Response{data=domain.IncidentDetailResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Incident not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/incidents/{incidentID}/resolve [post]
func (h *IncidentHandler) ResolveIncident(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	incidentID := c.Params("incidentID")
	userEmail := middleware.GetUserEmail(c)
	if userEmail == "" {
		userEmail = middleware.GetUserID(c)
	}

	resp, err := h.incidentSvc.ResolveIncident(c.Context(), projectID, incidentID, userEmail)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Incident resolved successfully")
}

// AddComment godoc
// @Summary Add comment to incident
// @Description Appends a collaboration comment entry to the incident's timeline.
// @Tags Incidents
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param incidentID path string true "Incident ID"
// @Param request body domain.AddIncidentCommentRequest true "Comment Body"
// @Success 201 {object} domain.Response{data=domain.IncidentTimelineItem}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Incident not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/incidents/{incidentID}/comments [post]
func (h *IncidentHandler) AddComment(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	incidentID := c.Params("incidentID")
	userEmail := middleware.GetUserEmail(c)
	if userEmail == "" {
		userEmail = middleware.GetUserID(c)
	}

	var req domain.AddIncidentCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewAppError(fiber.StatusBadRequest, domain.ErrCodeBadRequest, "Malformed JSON request body", nil)
	}

	if strings.TrimSpace(req.Body) == "" {
		return domain.NewValidationError("comment body cannot be empty", nil)
	}

	item, err := h.incidentSvc.AddComment(c.Context(), projectID, incidentID, userEmail, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusCreated, item, nil, "Comment added to incident timeline successfully")
}
