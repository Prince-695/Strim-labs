package handlers

import (
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// EndpointHandler handles API registry endpoint listing, inspection, and metadata updates.
type EndpointHandler struct {
	endpointSvc service.EndpointService
}

// NewEndpointHandler instantiates an EndpointHandler.
func NewEndpointHandler(endpointSvc service.EndpointService) *EndpointHandler {
	return &EndpointHandler{endpointSvc: endpointSvc}
}

// ListEndpoints retrieves discovered endpoints with filtering and keyset pagination.
// @Summary List registry endpoints
// @Description Returns endpoints for a project with method, tag, status, and search filters
// @Tags Registry
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param q query string false "Search query (path or service)"
// @Param method query string false "Filter by HTTP method"
// @Param tag query string false "Filter by tag"
// @Param source query string false "Filter by discovery source (openapi, ci, manifest, runtime)"
// @Param status query string false "Filter by status (active, stale, ignored)"
// @Param service query string false "Filter by service name"
// @Param sort query string false "Sort order (path_template, -last_seen)"
// @Param limit query int false "Results limit (default 50, max 100)"
// @Param cursor query string false "Pagination cursor"
// @Success 200 {object} domain.Response{data=[]domain.EndpointResponse,meta=domain.PageMeta}
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/endpoints [get]
func (h *EndpointHandler) ListEndpoints(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	var query domain.ListEndpointsQuery
	if err := c.QueryParser(&query); err != nil {
		return domain.NewBadRequestError("Invalid query parameters", err)
	}

	endpoints, meta, err := h.endpointSvc.ListEndpoints(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendOK(c, endpoints, meta)
}

// GetEndpoint retrieves detailed endpoint metadata, source provenance, and 24h stats.
// @Summary Get endpoint details
// @Description Returns endpoint details, discovery sources, and rolling statistics
// @Tags Registry
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param endpointID path string true "Endpoint ID"
// @Success 200 {object} domain.Response{data=domain.EndpointDetailResponse}
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/endpoints/{endpointID} [get]
func (h *EndpointHandler) GetEndpoint(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))
	endpointID := strings.TrimSpace(c.Params("endpointID"))

	resp, err := h.endpointSvc.GetEndpoint(c.Context(), projectID, endpointID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// PatchEndpoint updates mutable metadata (tags, note) or toggles status (active <-> ignored).
// @Summary Update endpoint
// @Description Updates tags, note, or status (active <-> ignored)
// @Tags Registry
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param endpointID path string true "Endpoint ID"
// @Param request body domain.PatchEndpointRequest true "Endpoint Patch Payload"
// @Success 200 {object} domain.Response{data=domain.EndpointResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/endpoints/{endpointID} [patch]
func (h *EndpointHandler) PatchEndpoint(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))
	endpointID := strings.TrimSpace(c.Params("endpointID"))

	var req domain.PatchEndpointRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.endpointSvc.PatchEndpoint(c.Context(), projectID, endpointID, req)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}
