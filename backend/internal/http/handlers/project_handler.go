package handlers

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// ProjectHandler manages endpoints for project creation, listing, updates, and target domain verification.
type ProjectHandler struct {
	projectSvc service.ProjectService
}

// NewProjectHandler instantiates a new ProjectHandler.
func NewProjectHandler(projectSvc service.ProjectService) *ProjectHandler {
	return &ProjectHandler{projectSvc: projectSvc}
}

// CreateProject creates a new project within an organization.
// @Summary Create project
// @Description Creates a new project in the organization (hard limit of 5 projects per org)
// @Tags Projects
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param request body domain.CreateProjectRequest true "Project Payload"
// @Success 201 {object} domain.Response{data=domain.ProjectResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects [post]
func (h *ProjectHandler) CreateProject(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)

	var req domain.CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.projectSvc.CreateProject(c.Context(), orgID, req)
	if err != nil {
		return err
	}

	return domain.SendCreated(c, resp)
}

// ListProjects returns all projects belonging to the organization.
// @Summary List organization projects
// @Description Returns all active projects for the organization (up to 5)
// @Tags Projects
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Success 200 {object} domain.Response{data=[]domain.ProjectResponse}
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects [get]
func (h *ProjectHandler) ListProjects(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)

	resp, err := h.projectSvc.ListProjects(c.Context(), orgID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// GetProject returns detailed project settings and rolling stats.
// @Summary Get project details
// @Description Returns project settings, verification status, and rolling 1-hour statistics
// @Tags Projects
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=domain.ProjectDetailResponse}
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID} [get]
func (h *ProjectHandler) GetProject(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)
	projectID := strings.TrimSpace(c.Params("projectID"))

	resp, err := h.projectSvc.GetProject(c.Context(), orgID, projectID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// UpdateProject modifies mutable project settings.
// @Summary Update project
// @Description Updates project name, description, environment, or base_url (changing host resets verification)
// @Tags Projects
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.UpdateProjectRequest true "Project Update Payload"
// @Success 200 {object} domain.Response{data=domain.ProjectResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID} [put]
func (h *ProjectHandler) UpdateProject(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)
	projectID := strings.TrimSpace(c.Params("projectID"))

	var req domain.UpdateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.projectSvc.UpdateProject(c.Context(), orgID, projectID, req)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// DeleteProject soft-deletes a project within an organization.
// @Summary Delete project
// @Description Soft-deletes a project (7-day purge grace)
// @Tags Projects
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID} [delete]
func (h *ProjectHandler) DeleteProject(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)
	projectID := strings.TrimSpace(c.Params("projectID"))

	if err := h.projectSvc.DeleteProject(c.Context(), orgID, projectID); err != nil {
		return err
	}

	return domain.SendMsg(c, "Project deleted successfully")
}

// InitiateVerification starts a proof of domain ownership challenge.
// @Summary Initiate domain verification
// @Description Starts a domain verification challenge and returns DNS TXT / HTTP file instructions
// @Tags Projects
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.InitiateVerificationRequest true "Verification Payload"
// @Success 201 {object} domain.Response{data=domain.VerificationResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/verification [post]
func (h *ProjectHandler) InitiateVerification(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)
	projectID := strings.TrimSpace(c.Params("projectID"))

	var req domain.InitiateVerificationRequest
	if err := c.BodyParser(&req); err != nil {
		// Default to DNS if no body provided
		req.Method = domain.MethodDNS
	}

	resp, err := h.projectSvc.InitiateVerification(c.Context(), orgID, projectID, req)
	if err != nil {
		return err
	}

	return domain.SendCreated(c, resp)
}

// CheckVerification immediately evaluates DNS TXT or HTTP file proof.
// @Summary Check domain verification
// @Description Executes domain verification check immediately and reports status
// @Tags Projects
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=domain.CheckVerificationResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/verification/check [post]
func (h *ProjectHandler) CheckVerification(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)
	projectID := strings.TrimSpace(c.Params("projectID"))

	resp, err := h.projectSvc.CheckVerification(c.Context(), orgID, projectID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// GetVerificationStatus returns active verification status and instructions.
// @Summary Get domain verification status
// @Description Returns active domain verification status and setup instructions
// @Tags Projects
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=domain.VerificationResponse}
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/verification [get]
func (h *ProjectHandler) GetVerificationStatus(c *fiber.Ctx) error {
	orgID := middleware.GetCurrentOrgID(c)
	projectID := strings.TrimSpace(c.Params("projectID"))

	resp, err := h.projectSvc.GetVerificationStatus(c.Context(), orgID, projectID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}
