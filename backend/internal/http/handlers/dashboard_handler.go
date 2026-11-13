package handlers

import (
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// DashboardHandler exposes endpoints for customizable observability dashboards.
type DashboardHandler struct {
	dashboardSvc service.DashboardService
	logger       *slog.Logger
}

// NewDashboardHandler initializes a DashboardHandler.
func NewDashboardHandler(dashboardSvc service.DashboardService, logger *slog.Logger) *DashboardHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &DashboardHandler{
		dashboardSvc: dashboardSvc,
		logger:       logger,
	}
}

// CreateDashboard godoc
// @Summary Create custom dashboard
// @Description Creates a new customizable dashboard with up to 30 widgets and templated queries.
// @Tags Dashboards
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.CreateDashboardRequest true "Dashboard Configuration"
// @Success 201 {object} domain.Response{data=domain.DashboardResponse}
// @Failure 400 {object} domain.Response "Bad Request / Validation Error"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/dashboards [post]
func (h *DashboardHandler) CreateDashboard(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")

	var req domain.CreateDashboardRequest
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

	dashResp, err := h.dashboardSvc.CreateDashboard(ctx, orgID, projectID, req)
	if err != nil {
		return err
	}

	return domain.SendCreated(c, dashResp)
}

// ListDashboards godoc
// @Summary List project dashboards
// @Description Retrieves summary metadata for all dashboards in a project (auto-seeds default if empty).
// @Tags Dashboards
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=[]domain.DashboardListItemResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/dashboards [get]
func (h *DashboardHandler) ListDashboards(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")

	dashboards, err := h.dashboardSvc.ListDashboards(c.Context(), orgID, projectID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, dashboards, nil)
}

// GetDashboard godoc
// @Summary Get dashboard details
// @Description Retrieves full dashboard object with grid layout coordinates and widget query configurations.
// @Tags Dashboards
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param dashboardID path string true "Dashboard ID"
// @Success 200 {object} domain.Response{data=domain.DashboardResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Dashboard Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/dashboards/{dashboardID} [get]
func (h *DashboardHandler) GetDashboard(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	dashboardID := c.Params("dashboardID")

	dashResp, err := h.dashboardSvc.GetDashboard(c.Context(), orgID, projectID, dashboardID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, dashResp, nil)
}

// UpdateDashboard godoc
// @Summary Update dashboard
// @Description Updates dashboard settings and widgets with optimistic concurrency control. Requires current version.
// @Tags Dashboards
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param dashboardID path string true "Dashboard ID"
// @Param request body domain.UpdateDashboardRequest true "Updated Dashboard Configuration"
// @Success 200 {object} domain.Response{data=domain.DashboardResponse}
// @Failure 400 {object} domain.Response "Validation Error"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Dashboard Not Found"
// @Failure 409 {object} domain.Response "Version Conflict"
// @Router /v1/organizations/{orgID}/projects/{projectID}/dashboards/{dashboardID} [put]
func (h *DashboardHandler) UpdateDashboard(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	dashboardID := c.Params("dashboardID")

	var req domain.UpdateDashboardRequest
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

	dashResp, err := h.dashboardSvc.UpdateDashboard(ctx, orgID, projectID, dashboardID, req)
	if err != nil {
		return err
	}

	return domain.SendOK(c, dashResp, nil)
}

// DeleteDashboard godoc
// @Summary Delete dashboard
// @Description Permanently removes a dashboard. Default system dashboards cannot be deleted.
// @Tags Dashboards
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param dashboardID path string true "Dashboard ID"
// @Success 200 {object} domain.Response
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden / Default Undeletable"
// @Failure 404 {object} domain.Response "Dashboard Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/dashboards/{dashboardID} [delete]
func (h *DashboardHandler) DeleteDashboard(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	dashboardID := c.Params("dashboardID")

	ctx := audit.WithAuditContext(
		c.Context(),
		middleware.GetUserID(c),
		middleware.GetUserEmail(c),
		c.IP(),
		c.Get("User-Agent"),
	)

	if err := h.dashboardSvc.DeleteDashboard(ctx, orgID, projectID, dashboardID); err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, nil, nil, "Dashboard deleted successfully")
}

// CloneDashboard godoc
// @Summary Clone dashboard
// @Description Duplicates an existing dashboard and all its widgets with fresh IDs.
// @Tags Dashboards
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param dashboardID path string true "Dashboard ID"
// @Param request body domain.CloneDashboardRequest false "Clone Options"
// @Success 201 {object} domain.Response{data=domain.DashboardResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Dashboard Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/dashboards/{dashboardID}/clone [post]
func (h *DashboardHandler) CloneDashboard(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	dashboardID := c.Params("dashboardID")

	var req domain.CloneDashboardRequest
	_ = c.BodyParser(&req)

	ctx := audit.WithAuditContext(
		c.Context(),
		middleware.GetUserID(c),
		middleware.GetUserEmail(c),
		c.IP(),
		c.Get("User-Agent"),
	)

	dashResp, err := h.dashboardSvc.CloneDashboard(ctx, orgID, projectID, dashboardID, req)
	if err != nil {
		return err
	}

	return domain.SendCreated(c, dashResp)
}
