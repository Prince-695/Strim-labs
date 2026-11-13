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
	"github.com/Prince-695/strim/backend/internal/sse"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type metricsTestContext struct {
	rig         *testRig
	orgID       string
	projectID   string
	endpointID  string
	tokens      map[string]string
	outsiderTok string
}

func setupMetricsTestContext(t *testing.T) *metricsTestContext {
	rig := newTestRig(t)
	ctx := context.Background()

	owner := &domain.User{ID: "usr-m-owner", Email: "owner@metrics.dev", IsVerified: true}
	admin := &domain.User{ID: "usr-m-admin", Email: "admin@metrics.dev", IsVerified: true}
	member := &domain.User{ID: "usr-m-member", Email: "member@metrics.dev", IsVerified: true}
	viewer := &domain.User{ID: "usr-m-viewer", Email: "viewer@metrics.dev", IsVerified: true}
	outsider := &domain.User{ID: "usr-m-outsider", Email: "outsider@metrics.dev", IsVerified: true}

	for _, u := range []*domain.User{owner, admin, member, viewer, outsider} {
		require.NoError(t, rig.userRepo.Create(ctx, u))
	}

	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Metrics Org",
		Slug: "metrics-org-" + owner.ID,
	})
	require.NoError(t, err)

	_, err = rig.orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{Email: admin.Email, Role: domain.RoleAdmin})
	require.NoError(t, err)
	_, err = rig.orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{Email: member.Email, Role: domain.RoleMember})
	require.NoError(t, err)
	_, err = rig.orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{Email: viewer.Email, Role: domain.RoleViewer})
	require.NoError(t, err)

	tokens := map[string]string{
		"owner":  rig.createAuthToken(t, owner.ID, owner.Email, true),
		"admin":  rig.createAuthToken(t, admin.ID, admin.Email, true),
		"member": rig.createAuthToken(t, member.ID, member.Email, true),
		"viewer": rig.createAuthToken(t, viewer.ID, viewer.Email, true),
	}
	outsiderTok := rig.createAuthToken(t, outsider.ID, outsider.Email, true)

	proj, err := rig.projectSvc.CreateProject(ctx, org.ID, domain.CreateProjectRequest{
		Name:    "Metrics Project",
		Slug:    "metrics-project-" + owner.ID,
		BaseURL: "https://api.acme.com",
	})
	require.NoError(t, err)

	ep, _, err := rig.endpointRepo.UpsertRoute(ctx, proj.ID, discovery.DiscoveredRoute{
		Method:       "GET",
		PathTemplate: "/orders/{id}",
		Service:      "orders",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	now := time.Now().UTC()
	sampleEvents := []domain.RequestEvent{
		{ProjectID: proj.ID, Timestamp: now.Add(-5 * time.Minute), Method: "GET", Route: "/orders/{id}", Status: 200, DurationMs: 25.0},
		{ProjectID: proj.ID, Timestamp: now.Add(-3 * time.Minute), Method: "GET", Route: "/orders/{id}", Status: 200, DurationMs: 35.0},
		{ProjectID: proj.ID, Timestamp: now.Add(-1 * time.Minute), Method: "GET", Route: "/orders/{id}", Status: 500, DurationMs: 140.0, IsError: true},
	}
	_ = rig.ingestStore.WriteEvents(ctx, sampleEvents)

	return &metricsTestContext{
		rig:         rig,
		orgID:       org.ID,
		projectID:   proj.ID,
		endpointID:  ep.ID,
		tokens:      tokens,
		outsiderTok: outsiderTok,
	}
}

func TestMetricsHandler_GetOverview(t *testing.T) {
	tc := setupMetricsTestContext(t)

	// 1. Viewer access: 200 OK
	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/overview?range=15m", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	resp, err := tc.rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(bodyBytes, &res)
	assert.True(t, res.Success)

	dataMap, ok := res.Data.(map[string]interface{})
	require.True(t, ok)
	currentMap := dataMap["current"].(map[string]interface{})
	assert.Equal(t, float64(3), currentMap["total_requests"])

	// 2. Outsider access: 403 or 404 Forbidden
	req = httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/overview", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.outsiderTok)
	resp, _ = tc.rig.app.Test(req, 5000)
	assert.Contains(t, []int{fiber.StatusForbidden, fiber.StatusNotFound}, resp.StatusCode)
}

func TestMetricsHandler_GetTimeseries(t *testing.T) {
	tc := setupMetricsTestContext(t)

	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/timeseries?range=15m&metric=p95", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["member"])

	resp, err := tc.rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(bodyBytes, &res)
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	assert.Equal(t, "p95", dataMap["metric"])
	assert.Equal(t, "ms", dataMap["unit"])
	seriesList := dataMap["series"].([]interface{})
	require.NotEmpty(t, seriesList)
}

func TestMetricsHandler_GetEndpointsMetrics(t *testing.T) {
	tc := setupMetricsTestContext(t)

	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/endpoints?range=15m", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])

	resp, err := tc.rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(bodyBytes, &res)
	assert.True(t, res.Success)

	epList := res.Data.([]interface{})
	require.NotEmpty(t, epList)
	epItem := epList[0].(map[string]interface{})
	assert.Equal(t, "/orders/{id}", epItem["path_template"])
	assert.Equal(t, float64(3), epItem["requests"])
}

func TestMetricsHandler_GetStatusCodes(t *testing.T) {
	tc := setupMetricsTestContext(t)

	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/status-codes?range=15m", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["owner"])

	resp, err := tc.rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(bodyBytes, &res)
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	classes := dataMap["classes"].(map[string]interface{})
	assert.Equal(t, float64(2), classes["2xx"])
	assert.Equal(t, float64(1), classes["5xx"])
}

func TestMetricsHandler_GetHostsMetrics(t *testing.T) {
	tc := setupMetricsTestContext(t)

	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/hosts?range=1h&host=host-1", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	resp, err := tc.rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(bodyBytes, &res)
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	assert.Equal(t, false, dataMap["connected"])
}

func TestMetricsHandler_StreamMetrics_SSE(t *testing.T) {
	tc := setupMetricsTestContext(t)

	// Close client after connection and initial snapshot are written so app.Test finishes
	go func() {
		topic := sse.FormatTopic(tc.projectID, "metrics")
		for i := 0; i < 50; i++ {
			time.Sleep(10 * time.Millisecond)
			if tc.rig.sseHub.SubscriberCount(topic) > 0 {
				time.Sleep(30 * time.Millisecond)
				tc.rig.sseHub.CloseTopicClients(topic)
				return
			}
		}
	}()

	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/stream?interval=2s", tc.orgID, tc.projectID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	resp, err := tc.rig.app.Test(req, 2000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Content-Type"), "text/event-stream")

	bodyBytes, _ := io.ReadAll(resp.Body)
	bodyStr := string(bodyBytes)
	assert.Contains(t, bodyStr, "event: overview")
}

func TestMetricsHandler_RBAC_Matrix(t *testing.T) {
	tc := setupMetricsTestContext(t)

	roles := []string{"owner", "admin", "member", "viewer"}

	for _, role := range roles {
		t.Run(role, func(t *testing.T) {
			req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/metrics/overview", tc.orgID, tc.projectID), nil)
			req.Header.Set("Authorization", "Bearer "+tc.tokens[role])

			resp, err := tc.rig.app.Test(req, 5000)
			require.NoError(t, err)
			assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		})
	}
}
