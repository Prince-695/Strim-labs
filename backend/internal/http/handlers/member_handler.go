package handlers

import (
	"strconv"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

type MemberHandler struct {
	orgSvc service.OrgService
}

func NewMemberHandler(orgSvc service.OrgService) *MemberHandler {
	return &MemberHandler{orgSvc: orgSvc}
}

// AddMember adds a user to an organization by email.
// @Summary Add organization member
// @Description Adds a user by email with role (viewer, member, admin). Owner cannot be assigned.
// @Tags Members
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param request body domain.AddMemberRequest true "Member Payload"
// @Success 201 {object} domain.Response{data=domain.OrgMemberDetailResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Router /v1/organizations/{orgID}/members [post]
func (h *MemberHandler) AddMember(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	actorUserID := middleware.GetUserID(c)

	var req domain.AddMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.orgSvc.AddMember(c.Context(), orgID, actorUserID, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusCreated, resp, nil, "Member added successfully")
}

// ListMembers lists members in the organization.
// @Summary List organization members
// @Description Lists members belonging to the organization with optional filtering
// @Tags Members
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param role query string false "Role filter"
// @Param q query string false "Search query"
// @Param limit query int false "Pagination limit"
// @Param cursor query string false "Pagination cursor"
// @Success 200 {object} domain.Response{data=[]domain.OrgMemberDetailResponse}
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/members [get]
func (h *MemberHandler) ListMembers(c *fiber.Ctx) error {
	orgID := c.Params("orgID")

	limit, _ := strconv.Atoi(c.Query("limit"))
	query := domain.ListMembersQuery{
		Role:   strings.TrimSpace(c.Query("role")),
		Q:      strings.TrimSpace(c.Query("q")),
		Limit:  limit,
		Cursor: strings.TrimSpace(c.Query("cursor")),
	}

	resp, err := h.orgSvc.ListMembers(c.Context(), orgID, query)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// UpdateRole updates a member's role (cannot modify owner or self).
// @Summary Update member role
// @Description Updates the role of an organization member
// @Tags Members
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param userID path string true "Member User ID"
// @Param request body domain.UpdateMemberRoleRequest true "Role Payload"
// @Success 200 {object} domain.Response{data=domain.OrgMemberDetailResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/members/{userID}/role [put]
func (h *MemberHandler) UpdateRole(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	targetUserID := c.Params("userID")
	actorUserID := middleware.GetUserID(c)

	var req domain.UpdateMemberRoleRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.orgSvc.UpdateMemberRole(c.Context(), orgID, actorUserID, targetUserID, req)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, resp, "Member role updated successfully")
}

// RemoveMember removes a member from the organization (cannot remove owner or self).
// @Summary Remove organization member
// @Description Removes a member from the organization
// @Tags Members
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param userID path string true "Member User ID"
// @Success 200 {object} domain.Response
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/members/{userID} [delete]
func (h *MemberHandler) RemoveMember(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	targetUserID := c.Params("userID")
	actorUserID := middleware.GetUserID(c)

	if err := h.orgSvc.RemoveMember(c.Context(), orgID, actorUserID, targetUserID); err != nil {
		return err
	}

	return domain.SendMsg(c, "Member removed successfully")
}

// LeaveOrg allows the caller to voluntarily leave the organization.
// @Summary Leave organization
// @Description Allows the caller to voluntarily leave the organization (sole owner cannot leave)
// @Tags Members
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Success 200 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID}/members/leave [post]
func (h *MemberHandler) LeaveOrg(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	actorUserID := middleware.GetUserID(c)

	if err := h.orgSvc.LeaveOrg(c.Context(), orgID, actorUserID); err != nil {
		return err
	}

	return domain.SendMsg(c, "Left organization successfully")
}
