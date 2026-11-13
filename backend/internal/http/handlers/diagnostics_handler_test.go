package handlers_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDiagnosticsHandler_GetSlowEndpoints(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()
	now := time.Now().UTC()

	// Seed routes in endpointRepo
	_, _, err := tc.rig.endpointRepo.UpsertRoute(ctx, tc.projectID, discovery.DiscoveredRoute{
		Method:       "GET",
		PathTemplate: "/api/fast",
		Service:      "main-svc",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	_, _, err = tc.rig.endpointRepo.UpsertRoute(ctx, tc.projectID, discovery.DiscoveredRoute{
		Method:       "POST",
		PathTemplate: "/api/slow",
		Service:      "order-svc",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	// Seed events in ingest store:
	// /api/fast: 100 requests @ 10ms -> P95 ~ 10ms -> Impact = 100 * 10 = 1000
	fastEvents := make([]domain.RequestEvent, 100)
	for i := range fastEvents {
		fastEvents[i] = domain.RequestEvent{
			ProjectID:  tc.projectID,
			Method:     "GET",
			Route:      "/api/fast",
			Service:    "main-svc",
			Status:     200,
			DurationMs: 10,
			Timestamp:  now.Add(-10 * time.Minute),
		}
	}
	require.NoError(t, tc.rig.ingestStore.WriteEvents(ctx, fastEvents))

	// /api/slow: 50 requests @ 200ms -> P95 ~ 200ms -> Impact = 50 * 200 = 10000
	slowEvents := make([]domain.RequestEvent, 50)
	for i := range slowEvents {
		slowEvents[i] = domain.RequestEvent{
			ProjectID:  tc.projectID,
			Method:     "POST",
			Route:      "/api/slow",
			Service:    "order-svc",
			Status:     200,
			DurationMs: 200,
			Timestamp:  now.Add(-10 * time.Minute),
		}
	}
	require.NoError(t, tc.rig.ingestStore.WriteEvents(ctx, slowEvents))

	// 1. Success query with owner token
	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/slow-endpoints?range=1h&limit=5&min_requests=1", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["owner"])
	resp, err := tc.rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var body domain.Response
	respBytes, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(respBytes, &body))
	assert.True(t, body.Success)

	dataMap, ok := body.Data.(map[string]interface{})
	require.True(t, ok)
	endpoints, ok := dataMap["endpoints"].([]interface{})
	require.True(t, ok)
	require.Len(t, endpoints, 2)

	first := endpoints[0].(map[string]interface{})
	assert.Equal(t, "POST", first["method"])
	assert.Equal(t, "/api/slow", first["route"])
	assert.Equal(t, "order-svc", first["service"])

	// 2. Query with invalid limit
	reqBadLimit := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/slow-endpoints?limit=100", tc.orgID, tc.projectID), nil)
	reqBadLimit.Header.Set("Authorization", "Bearer "+tc.tokens["owner"])
	respBad, err := tc.rig.app.Test(reqBadLimit)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, respBad.StatusCode)

	// 3. Query with invalid time range
	reqBadRange := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/slow-endpoints?range=invalid", tc.orgID, tc.projectID), nil)
	reqBadRange.Header.Set("Authorization", "Bearer "+tc.tokens["owner"])
	respBadRange, err := tc.rig.app.Test(reqBadRange)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, respBadRange.StatusCode)
}

func TestDiagnosticsHandler_GetRegressions(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()
	now := time.Now().UTC()

	// Seed routes
	_, _, err := tc.rig.endpointRepo.UpsertRoute(ctx, tc.projectID, discovery.DiscoveredRoute{
		Method:       "GET",
		PathTemplate: "/api/data",
		Service:      "data-svc",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	// Previous baseline: 50 requests @ 50ms
	prevEvents := make([]domain.RequestEvent, 50)
	for i := range prevEvents {
		prevEvents[i] = domain.RequestEvent{
			ProjectID:  tc.projectID,
			Method:     "GET",
			Route:      "/api/data",
			Service:    "data-svc",
			Status:     200,
			DurationMs: 50,
			Timestamp:  now.Add(-90 * time.Minute),
		}
	}
	require.NoError(t, tc.rig.ingestStore.WriteEvents(ctx, prevEvents))

	// Current window: 50 requests @ 150ms (+200% latency regression)
	currEvents := make([]domain.RequestEvent, 50)
	for i := range currEvents {
		currEvents[i] = domain.RequestEvent{
			ProjectID:  tc.projectID,
			Method:     "GET",
			Route:      "/api/data",
			Service:    "data-svc",
			Status:     200,
			DurationMs: 150,
			Timestamp:  now.Add(-10 * time.Minute),
		}
	}
	require.NoError(t, tc.rig.ingestStore.WriteEvents(ctx, currEvents))

	// 1. Success query against previous period
	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/regressions?range=1h&baseline=previous", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	resp, err := tc.rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var body domain.Response
	respBytes, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(respBytes, &body))
	assert.True(t, body.Success)

	dataMap, ok := body.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "previous", dataMap["baseline"])
	regressions, ok := dataMap["regressions"].([]interface{})
	require.True(t, ok)
	require.NotEmpty(t, regressions)

	reg0 := regressions[0].(map[string]interface{})
	assert.Equal(t, "/api/data", reg0["route"])
	assert.Equal(t, domain.RegressionSeverityCritical, reg0["severity"])

	// 2. Query against a load test baseline
	lt := &domain.LoadTest{
		ID:        "test-diag-baseline",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "Baseline Load Test",
		Status:    domain.LoadTestStatusCompleted,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, lt))

	perEpList := []domain.PerEndpointResult{
		{
			Method:    "GET",
			Path:      "/api/data",
			Requests:  1000,
			ErrorRate: 0.01,
			LatencyMS: domain.LoadTestLatencySummary{P95: 50.0},
		},
	}
	perEpBytes, _ := json.Marshal(map[string]interface{}{"items": perEpList})
	var perEpJSON domain.JSONMap
	_ = json.Unmarshal(perEpBytes, &perEpJSON)

	require.NoError(t, tc.rig.loadTestRepo.CreateResults(ctx, &domain.LoadTestResults{
		TestID:      "test-diag-baseline",
		PerEndpoint: perEpJSON,
		CreatedAt:   now,
	}))

	reqLT := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/regressions?range=1h&baseline=test:%s", tc.orgID, tc.projectID, lt.ID), nil)
	reqLT.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respLT, err := tc.rig.app.Test(reqLT)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respLT.StatusCode)

	// 3. Query with non-existent load test baseline -> 404 Not Found
	reqLTBad := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/regressions?range=1h&baseline=test:nonexistent", tc.orgID, tc.projectID), nil)
	reqLTBad.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respLTBad, err := tc.rig.app.Test(reqLTBad)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, respLTBad.StatusCode)

	// 4. Query with invalid baseline string -> 400 Bad Request
	reqInvalidBase := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/regressions?range=1h&baseline=invalid-base", tc.orgID, tc.projectID), nil)
	reqInvalidBase.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	respInvalidBase, err := tc.rig.app.Test(reqInvalidBase)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, respInvalidBase.StatusCode)
}

func TestDiagnosticsHandler_GetBottlenecks(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()
	now := time.Now().UTC()

	// Seed routes
	_, _, err := tc.rig.endpointRepo.UpsertRoute(ctx, tc.projectID, discovery.DiscoveredRoute{
		Method:       "GET",
		PathTemplate: "/heavy",
		Service:      "heavy-svc",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	// Ingest tail dispersion events (P50 = 10ms, P99 = 100ms -> dispersion ratio = 10.0 >= 4.0)
	events := make([]domain.RequestEvent, 100)
	for i := 0; i < 90; i++ {
		events[i] = domain.RequestEvent{
			ProjectID:  tc.projectID,
			Method:     "GET",
			Route:      "/heavy",
			Service:    "heavy-svc",
			Status:     200,
			DurationMs: 10,
			Timestamp:  now.Add(-5 * time.Minute),
		}
	}
	for i := 90; i < 100; i++ {
		events[i] = domain.RequestEvent{
			ProjectID:  tc.projectID,
			Method:     "GET",
			Route:      "/heavy",
			Service:    "heavy-svc",
			Status:     200,
			DurationMs: 100,
			Timestamp:  now.Add(-5 * time.Minute),
		}
	}
	require.NoError(t, tc.rig.ingestStore.WriteEvents(ctx, events))

	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/bottlenecks?range=1h", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])
	resp, err := tc.rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var body domain.Response
	respBytes, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(respBytes, &body))
	assert.True(t, body.Success)

	dataMap, ok := body.Data.(map[string]interface{})
	require.True(t, ok)
	hints, ok := dataMap["hints"].([]interface{})
	require.True(t, ok)
	require.NotEmpty(t, hints)

	// Every bottleneck hint must have kind: hint
	for _, h := range hints {
		hm := h.(map[string]interface{})
		assert.Equal(t, "hint", hm["kind"])
		assert.NotEmpty(t, hm["type"])
		assert.NotEmpty(t, hm["confidence"])
		assert.NotEmpty(t, hm["message"])
		assert.NotNil(t, hm["evidence"])
	}
}

func TestDiagnosticsHandler_RBAC_Matrix(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	endpoints := []string{
		fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/slow-endpoints", tc.orgID, tc.projectID),
		fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/regressions", tc.orgID, tc.projectID),
		fmt.Sprintf("/v1/organizations/%s/projects/%s/diagnostics/bottlenecks", tc.orgID, tc.projectID),
	}

	// 1. Roles (owner, admin, member, viewer) must all have read access (200 OK)
	for _, ep := range endpoints {
		for _, role := range []string{"owner", "admin", "member", "viewer"} {
			req := httptest.NewRequest("GET", ep, nil)
			req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
			resp, err := tc.rig.app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, fiber.StatusOK, resp.StatusCode, "endpoint %s for role %s", ep, role)
		}
	}

	// 2. Outsider must be completely isolated -> 404 Not Found (no leak of tenant or project existence)
	for _, ep := range endpoints {
		req := httptest.NewRequest("GET", ep, nil)
		req.Header.Set("Authorization", "Bearer "+tc.outsiderTok)
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode, "outsider isolation on %s", ep)
	}

	// 3. Unauthenticated requests must receive 401 Unauthorized
	for _, ep := range endpoints {
		req := httptest.NewRequest("GET", ep, nil)
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode, "unauthenticated on %s", ep)
	}
}
