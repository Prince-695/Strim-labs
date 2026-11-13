package handlers

import (
	"io"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// DiscoveryHandler manages route discovery via OpenAPI imports, manifests, and CI scanner endpoints.
type DiscoveryHandler struct {
	discoverySvc service.DiscoveryService
	apiKeySvc    *service.APIKeyService
}

// NewDiscoveryHandler instantiates a DiscoveryHandler.
func NewDiscoveryHandler(discoverySvc service.DiscoveryService) *DiscoveryHandler {
	return &DiscoveryHandler{discoverySvc: discoverySvc}
}

// SetAPIKeyService attaches an API key validation service.
func (h *DiscoveryHandler) SetAPIKeyService(apiKeySvc *service.APIKeyService) {
	h.apiKeySvc = apiKeySvc
}

// ImportOpenAPI imports an OpenAPI specification via multipart file upload or remote URL.
// @Summary Import OpenAPI specification
// @Description Ingests endpoints from an OpenAPI 2.0 (Swagger) or OpenAPI 3.x spec file (<= 5MB) or remote URL
// @Tags Discovery
// @Security BearerAuth
// @Accept multipart/form-data,json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param file formData file false "OpenAPI Spec File"
// @Param request body domain.ImportOpenAPIRequest false "OpenAPI Spec URL Payload"
// @Success 200 {object} domain.Response{data=domain.DiscoveryRunResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/discovery/openapi [post]
func (h *DiscoveryHandler) ImportOpenAPI(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	// Check if a file was uploaded via multipart/form-data
	fileHeader, err := c.FormFile("file")
	if err == nil && fileHeader != nil {
		if fileHeader.Size > 5*1024*1024 {
			return domain.NewBadRequestError("OpenAPI file exceeds the 5 MB limit", nil)
		}

		file, err := fileHeader.Open()
		if err != nil {
			return domain.NewBadRequestError("Failed to read uploaded spec file", err)
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			return domain.NewBadRequestError("Failed to read uploaded spec file content", err)
		}

		resp, err := h.discoverySvc.ImportOpenAPI(c.Context(), projectID, data, "")
		if err != nil {
			return err
		}
		return domain.SendOK(c, resp, nil)
	}

	// Check if URL was passed in JSON body
	var req domain.ImportOpenAPIRequest
	if err := c.BodyParser(&req); err == nil && req.URL != "" {
		resp, err := h.discoverySvc.ImportOpenAPI(c.Context(), projectID, nil, req.URL)
		if err != nil {
			return err
		}
		return domain.SendOK(c, resp, nil)
	}

	return domain.NewBadRequestError("Either a multipart file or a JSON 'url' payload must be provided", nil)
}

// ImportManifest imports routes from a structured JSON route manifest.
// @Summary Import route manifest
// @Description Ingests routes declared in a route manifest v1 JSON payload
// @Tags Discovery
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.DiscoveryManifest true "Route Manifest Payload"
// @Success 200 {object} domain.Response{data=domain.DiscoveryRunResponse}
// @Failure 400 {object} domain.Response
// @Failure 403 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/discovery/manifest [post]
func (h *DiscoveryHandler) ImportManifest(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	var manifest domain.DiscoveryManifest
	if err := c.BodyParser(&manifest); err != nil {
		return domain.NewBadRequestError("Malformed JSON manifest payload", err)
	}

	resp, err := h.discoverySvc.ImportManifest(c.Context(), projectID, &manifest)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// ListDiscoveryRuns lists historical discovery execution runs for a project.
// @Summary List discovery runs
// @Description Returns recent discovery runs and ingestion audit history
// @Tags Discovery
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param limit query int false "Limit (default 20, max 100)"
// @Success 200 {object} domain.Response{data=[]domain.DiscoveryRunResponse}
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/discovery/runs [get]
func (h *DiscoveryHandler) ListDiscoveryRuns(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))
	limit := c.QueryInt("limit", 20)

	resp, err := h.discoverySvc.ListDiscoveryRuns(c.Context(), projectID, limit)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// IngestDiscovery is the CI scanner ingest endpoint.
// @Summary Ingest discovery from CI scanner
// @Description Ingests routes discovered during CI pipeline runs
// @Tags Discovery
// @Accept json
// @Produce json
// @Param X-Project-ID header string false "Project ID"
// @Param project_id query string false "Project ID"
// @Param request body domain.DiscoveryManifest true "CI Route Manifest"
// @Success 200 {object} domain.Response{data=domain.DiscoveryRunResponse}
// @Failure 400 {object} domain.Response
// @Router /v1/ingest/discovery [post]
func (h *DiscoveryHandler) IngestDiscovery(c *fiber.Ctx) error {
	apiKey := strings.TrimSpace(c.Get("X-API-Key"))
	if apiKey == "" {
		authHeader := strings.TrimSpace(c.Get("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			apiKey = strings.TrimSpace(authHeader[7:])
		}
	}

	var projectID string
	if h.apiKeySvc != nil && strings.HasPrefix(apiKey, "strim_") {
		key, err := h.apiKeySvc.ValidateKey(c.Context(), apiKey, domain.ScopeDiscovery)
		if err != nil {
			return err
		}
		projectID = key.ProjectID
	} else {
		projectID = strings.TrimSpace(c.Get("X-Project-ID"))
		if projectID == "" {
			projectID = strings.TrimSpace(c.Query("project_id"))
		}
		if projectID == "" {
			projectID = apiKey
		}
	}

	if projectID == "" {
		return domain.NewBadRequestError("Project ID or API Key must be specified via X-API-Key, X-Project-ID header or project_id query parameter", nil)
	}

	var manifest domain.DiscoveryManifest
	if err := c.BodyParser(&manifest); err != nil {
		return domain.NewBadRequestError("Malformed JSON manifest payload", err)
	}
	manifest.Source = domain.SourceCI

	resp, err := h.discoverySvc.ImportManifest(c.Context(), projectID, &manifest)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}
