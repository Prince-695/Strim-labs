package handlers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAPIKeyHandler_CRUD_And_IngestAuth(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// 1. Create API Key (Admin+)
	createReqBody, _ := json.Marshal(domain.CreateAPIKeyRequest{
		Name:   "Production Ingestion Key",
		Scopes: []string{string(domain.ScopeIngest), string(domain.ScopeDiscovery)},
	})
	reqCreate := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys", tc.orgID, tc.projectID), bytes.NewReader(createReqBody))
	reqCreate.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	reqCreate.Header.Set("Content-Type", "application/json")
	respCreate, err := tc.rig.app.Test(reqCreate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respCreate.StatusCode)

	var createResp domain.Response
	_ = json.NewDecoder(respCreate.Body).Decode(&createResp)
	keyData := createResp.Data.(map[string]interface{})
	keyID := keyData["id"].(string)
	secret := keyData["secret"].(string)
	prefix := keyData["prefix"].(string)

	assert.NotEmpty(t, secret)
	assert.NotEmpty(t, prefix)
	assert.Contains(t, secret, prefix)

	// 2. List API Keys (Admin+) -> secrets must be masked/omitted
	reqList := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys", tc.orgID, tc.projectID), nil)
	reqList.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respList, err := tc.rig.app.Test(reqList)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respList.StatusCode)

	var listResp domain.Response
	_ = json.NewDecoder(respList.Body).Decode(&listResp)
	items := listResp.Data.([]interface{})
	require.NotEmpty(t, items)
	firstKey := items[0].(map[string]interface{})
	assert.Empty(t, firstKey["secret"])

	// 3. Telemetry Ingestion using the raw API key secret in X-API-Key
	ingestPayload := domain.IngestEventsRequest{
		Events: []domain.IngestEventItem{
			{Method: "POST", Path: "/api/checkout", Status: 200, DurationMs: 120},
		},
	}
	ingestBytes, _ := json.Marshal(ingestPayload)
	reqIngest := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(ingestBytes))
	reqIngest.Header.Set("Content-Type", "application/json")
	reqIngest.Header.Set("X-API-Key", secret)
	respIngest, err := tc.rig.app.Test(reqIngest)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, respIngest.StatusCode)

	// 4. Rotate Key (Admin+)
	graceHours := 24
	rotateReqBody, _ := json.Marshal(domain.RotateAPIKeyRequest{
		GraceHours: &graceHours,
	})
	reqRotate := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys/%s/rotate", tc.orgID, tc.projectID, keyID), bytes.NewReader(rotateReqBody))
	reqRotate.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	reqRotate.Header.Set("Content-Type", "application/json")
	respRotate, err := tc.rig.app.Test(reqRotate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respRotate.StatusCode)

	var rotateResp domain.Response
	_ = json.NewDecoder(respRotate.Body).Decode(&rotateResp)
	rotData := rotateResp.Data.(map[string]interface{})
	newKeyID := rotData["id"].(string)
	newSecret := rotData["secret"].(string)
	assert.NotEmpty(t, newSecret)
	assert.NotEqual(t, secret, newSecret)

	// Old secret remains valid during grace period
	reqIngestOld := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(ingestBytes))
	reqIngestOld.Header.Set("Content-Type", "application/json")
	reqIngestOld.Header.Set("X-API-Key", secret)
	respIngestOld, err := tc.rig.app.Test(reqIngestOld)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, respIngestOld.StatusCode)

	// New secret works immediately
	reqIngestNew := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(ingestBytes))
	reqIngestNew.Header.Set("Content-Type", "application/json")
	reqIngestNew.Header.Set("X-API-Key", newSecret)
	respIngestNew, err := tc.rig.app.Test(reqIngestNew)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, respIngestNew.StatusCode)

	// 5. Revoke new Key (Admin+)
	reqRevoke := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys/%s", tc.orgID, tc.projectID, newKeyID), nil)
	reqRevoke.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respRevoke, err := tc.rig.app.Test(reqRevoke)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respRevoke.StatusCode)

	// Ingestion with revoked key fails immediately
	reqIngestRevoked := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(ingestBytes))
	reqIngestRevoked.Header.Set("Content-Type", "application/json")
	reqIngestRevoked.Header.Set("X-API-Key", newSecret)
	respIngestRevoked, err := tc.rig.app.Test(reqIngestRevoked)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, respIngestRevoked.StatusCode)
}

func TestWebhookHandler_CRUD_And_Deliveries(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// 1. Create Webhook (Admin+)
	createReqBody, _ := json.Marshal(domain.CreateWebhookRequest{
		URL:    "https://api.acme.com/webhook",
		Events: []string{string(domain.EventTestCompleted), string(domain.EventIncidentOpened)},
	})
	reqCreate := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/webhooks", tc.orgID, tc.projectID), bytes.NewReader(createReqBody))
	reqCreate.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	reqCreate.Header.Set("Content-Type", "application/json")
	respCreate, err := tc.rig.app.Test(reqCreate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respCreate.StatusCode)

	var createResp domain.Response
	_ = json.NewDecoder(respCreate.Body).Decode(&createResp)
	hookData := createResp.Data.(map[string]interface{})
	webhookID := hookData["id"].(string)
	assert.Equal(t, "***", hookData["secret"]) // Secret masked as ***

	// 2. List Webhooks
	reqList := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/webhooks", tc.orgID, tc.projectID), nil)
	reqList.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respList, err := tc.rig.app.Test(reqList)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respList.StatusCode)

	// 3. Update Webhook
	newURL := "https://api-v2.acme.com/webhook"
	upReqBody, _ := json.Marshal(domain.UpdateWebhookRequest{
		URL: &newURL,
	})
	reqUpdate := httptest.NewRequest("PUT", fmt.Sprintf("/v1/organizations/%s/projects/%s/webhooks/%s", tc.orgID, tc.projectID, webhookID), bytes.NewReader(upReqBody))
	reqUpdate.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	reqUpdate.Header.Set("Content-Type", "application/json")
	respUpdate, err := tc.rig.app.Test(reqUpdate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respUpdate.StatusCode)

	// 4. List Deliveries
	reqDel := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/webhooks/%s/deliveries", tc.orgID, tc.projectID, webhookID), nil)
	reqDel.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respDel, err := tc.rig.app.Test(reqDel)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respDel.StatusCode)

	// 5. Delete Webhook
	reqDelHook := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/webhooks/%s", tc.orgID, tc.projectID, webhookID), nil)
	reqDelHook.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respDelHook, err := tc.rig.app.Test(reqDelHook)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respDelHook.StatusCode)
}

func TestAuditHandler_ListLogs(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// Create an API key to guarantee audit trail entry exists
	createReqBody, _ := json.Marshal(domain.CreateAPIKeyRequest{
		Name:   "Audit Trail Key",
		Scopes: []string{string(domain.ScopeIngest)},
	})
	reqKey := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys", tc.orgID, tc.projectID), bytes.NewReader(createReqBody))
	reqKey.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	reqKey.Header.Set("Content-Type", "application/json")
	_, _ = tc.rig.app.Test(reqKey)

	// Query audit logs
	reqAudit := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/audit-logs", tc.orgID), nil)
	reqAudit.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respAudit, err := tc.rig.app.Test(reqAudit)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respAudit.StatusCode)

	b, _ := io.ReadAll(respAudit.Body)
	assert.Contains(t, string(b), "api_key.created")
}

func TestUsageHandler_GetUsage(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	reqUsage := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/usage", tc.orgID), nil)
	reqUsage.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	respUsage, err := tc.rig.app.Test(reqUsage)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respUsage.StatusCode)

	var usageResp domain.Response
	_ = json.NewDecoder(respUsage.Body).Decode(&usageResp)
	usageData := usageResp.Data.(map[string]interface{})

	metrics := usageData["metrics"].(map[string]interface{})
	assert.Contains(t, metrics, "events_ingested")
	assert.Contains(t, metrics, "load_test_minutes")
	assert.Contains(t, metrics, "requests_generated")
	assert.Contains(t, metrics, "projects")
}

func TestPhase11_RBAC_Matrix(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// Endpoint 1: POST /api-keys (Admin+)
	apiKeyURL := fmt.Sprintf("/v1/organizations/%s/projects/%s/api-keys", tc.orgID, tc.projectID)
	keyBody, _ := json.Marshal(domain.CreateAPIKeyRequest{
		Name:   "RBAC Test Key",
		Scopes: []string{string(domain.ScopeIngest)},
	})

	// Endpoint 2: GET /audit-logs (Admin+)
	auditURL := fmt.Sprintf("/v1/organizations/%s/audit-logs", tc.orgID)

	// Endpoint 3: GET /usage (Admin+)
	usageURL := fmt.Sprintf("/v1/organizations/%s/usage", tc.orgID)

	// 1. Owner & Admin CAN access
	for _, role := range []string{"owner", "admin"} {
		req := httptest.NewRequest("GET", auditURL, nil)
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode, "Role %s should have access to audit logs", role)

		reqU := httptest.NewRequest("GET", usageURL, nil)
		reqU.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		respU, err := tc.rig.app.Test(reqU)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusOK, respU.StatusCode, "Role %s should have access to usage", role)
	}

	// 2. Member & Viewer CANNOT create API keys (403 Forbidden)
	for _, role := range []string{"member", "viewer"} {
		req := httptest.NewRequest("POST", apiKeyURL, bytes.NewReader(keyBody))
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		req.Header.Set("Content-Type", "application/json")
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode, "Role %s should be forbidden from creating API keys", role)
	}

	// 3. Member & Viewer CANNOT access audit logs or usage (403 Forbidden)
	for _, role := range []string{"member", "viewer"} {
		req := httptest.NewRequest("GET", auditURL, nil)
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode, "Role %s should be forbidden from viewing audit logs", role)

		reqU := httptest.NewRequest("GET", usageURL, nil)
		reqU.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		respU, err := tc.rig.app.Test(reqU)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusForbidden, respU.StatusCode, "Role %s should be forbidden from viewing usage", role)
	}

	// 4. Outsider gets 404 Not Found (Zero Tenant Leakage)
	outsiderReq := httptest.NewRequest("GET", auditURL, nil)
	outsiderReq.Header.Set("Authorization", "Bearer "+tc.outsiderTok)
	outsiderResp, err := tc.rig.app.Test(outsiderReq)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, outsiderResp.StatusCode)

	// 5. Unauthenticated gets 401 Unauthorized
	unauthReq := httptest.NewRequest("GET", auditURL, nil)
	unauthResp, err := tc.rig.app.Test(unauthReq)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, unauthResp.StatusCode)
}
