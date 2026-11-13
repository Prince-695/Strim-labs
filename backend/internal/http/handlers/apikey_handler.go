package handlers

import (
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// APIKeyHandler handles HTTP endpoints for API key management.
type APIKeyHandler struct {
	apiKeySvc *service.APIKeyService
	logger    *slog.Logger
}

// NewAPIKeyHandler initializes an APIKeyHandler.
func NewAPIKeyHandler(apiKeySvc *service.APIKeyService, logger *slog.Logger) *APIKeyHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &APIKeyHandler{
		apiKeySvc: apiKeySvc,
		logger:    logger,
	}
}

// CreateKey godoc
// @Summary Create project API key
// @Description Generates a cryptographically secure API key. The secret token is revealed only once.
// @Tags APIKeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param request body domain.CreateAPIKeyRequest true "API Key Parameters"
// @Success 201 {object} domain.Response{data=domain.APIKeyResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/api-keys [post]
func (h *APIKeyHandler) CreateKey(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")

	var req domain.CreateAPIKeyRequest
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

	keyResp, err := h.apiKeySvc.CreateKey(ctx, orgID, projectID, &req)
	if err != nil {
		return err
	}

	return domain.SendCreated(c, keyResp)
}

// ListKeys godoc
// @Summary List project API keys
// @Description Retrieves all active and inactive API keys for a project (secrets omitted).
// @Tags APIKeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Success 200 {object} domain.Response{data=[]domain.APIKeyResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/api-keys [get]
func (h *APIKeyHandler) ListKeys(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")

	keys, err := h.apiKeySvc.ListKeys(c.Context(), orgID, projectID)
	if err != nil {
		return err
	}

	return domain.SendOK(c, keys, nil)
}

// RotateKey godoc
// @Summary Rotate project API key
// @Description Issues a replacement API key while retaining the existing key for a dual-active grace period.
// @Tags APIKeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param keyID path string true "API Key ID"
// @Param request body domain.RotateAPIKeyRequest false "Rotation Parameters"
// @Success 200 {object} domain.Response{data=domain.APIKeyResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/api-keys/{keyID}/rotate [post]
func (h *APIKeyHandler) RotateKey(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	keyID := c.Params("keyID")

	var req domain.RotateAPIKeyRequest
	_ = c.BodyParser(&req)

	ctx := audit.WithAuditContext(
		c.Context(),
		middleware.GetUserID(c),
		middleware.GetUserEmail(c),
		c.IP(),
		c.Get("User-Agent"),
	)

	keyResp, err := h.apiKeySvc.RotateKey(ctx, orgID, projectID, keyID, &req)
	if err != nil {
		return err
	}

	return domain.SendOK(c, keyResp, nil)
}

// RevokeKey godoc
// @Summary Revoke project API key
// @Description Permanently revokes an API key immediately.
// @Tags APIKeys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param keyID path string true "API Key ID"
// @Success 200 {object} domain.Response{data=map[string]interface{}}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Not Found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/api-keys/{keyID} [delete]
func (h *APIKeyHandler) RevokeKey(c *fiber.Ctx) error {
	orgID := c.Params("orgID")
	projectID := c.Params("projectID")
	keyID := c.Params("keyID")

	ctx := audit.WithAuditContext(
		c.Context(),
		middleware.GetUserID(c),
		middleware.GetUserEmail(c),
		c.IP(),
		c.Get("User-Agent"),
	)

	if err := h.apiKeySvc.RevokeKey(ctx, orgID, projectID, keyID); err != nil {
		return err
	}

	return domain.SendOK(c, fiber.Map{
		"message": "API key revoked successfully",
	}, nil)
}
