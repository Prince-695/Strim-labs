package handlers

import (
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

type OrgHandler struct {
	orgSvc service.OrgService
}

func NewOrgHandler(orgSvc service.OrgService) *OrgHandler {
	return &OrgHandler{orgSvc: orgSvc}
}

func (h *OrgHandler) OrgService() service.OrgService {
	return h.orgSvc
}

// CreateOrg creates a new workspace and sets the creator as owner.
// @Summary Create organization
// @Description Creates an organization workspace with caller as owner (max 3 orgs per user)
// @Tags Organizations
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param request body domain.CreateOrgRequest true "Organization Payload"
// @Success 201 {object} domain.Response{data=domain.OrgResponse}
// @Failure 400 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Router /v1/organizations [post]
func (h *OrgHandler) CreateOrg(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req domain.CreateOrgRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.orgSvc.CreateOrg(c.Context(), userID, req)
	if err != nil {
		return err
	}

	return domain.SendCreated(c, resp)
}

// ListOrgs returns all organizations the caller belongs to.
// @Summary List user organizations
// @Description Lists organizations the authenticated user belongs to (up to 3)
// @Tags Organizations
// @Security BearerAuth
// @Produce json
// @Success 200 {object} domain.Response{data=[]domain.OrgResponse}
// @Failure 401 {object} domain.Response
// @Router /v1/organizations [get]
func (h *OrgHandler) ListOrgs(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	resp, err := h.orgSvc.ListUserOrgs(c.Context(), userID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// GetOrg retrieves organization details.
// @Summary Get organization details
// @Description Retrieves organization details for members (404 for non-members)
// @Tags Organizations
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Success 200 {object} domain.Response{data=domain.OrgResponse}
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID} [get]
func (h *OrgHandler) GetOrg(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	userID := middleware.GetUserID(c)

	resp, err := h.orgSvc.GetOrg(c.Context(), orgID, userID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// UpdateOrg updates organization name and description.
// @Summary Update organization details
// @Description Updates organization name and description (slug is immutable)
// @Tags Organizations
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param request body domain.UpdateOrgRequest true "Update Payload"
// @Success 200 {object} domain.Response{data=domain.OrgResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID} [put]
func (h *OrgHandler) UpdateOrg(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	userID := middleware.GetUserID(c)

	var req domain.UpdateOrgRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.orgSvc.UpdateOrg(c.Context(), orgID, userID, req)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, resp, "Organization updated successfully")
}

// DeleteOrg soft-deletes the organization with confirm_slug verification.
// @Summary Delete organization
// @Description Soft-deletes organization requiring slug confirmation (owner only)
// @Tags Organizations
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param request body domain.DeleteOrgRequest true "Confirmation Payload"
// @Success 200 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID} [delete]
func (h *OrgHandler) DeleteOrg(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	userID := middleware.GetUserID(c)

	var req domain.DeleteOrgRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	if err := h.orgSvc.DeleteOrg(c.Context(), orgID, userID, req); err != nil {
		return err
	}

	return domain.SendMsg(c, "Organization deleted successfully")
}
