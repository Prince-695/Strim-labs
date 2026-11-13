package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type loadTestHTTPTestContext struct {
	rig         *testRig
	orgID       string
	projectID   string
	tokens      map[string]string
	outsiderTok string
}

func setupLoadTestHTTPContext(t *testing.T) *loadTestHTTPTestContext {
	rig := newTestRig(t)
	ctx := context.Background()

	owner := &domain.User{ID: "usr-lt-owner", Email: "owner@loadtest.dev", IsVerified: true}
	admin := &domain.User{ID: "usr-lt-admin", Email: "admin@loadtest.dev", IsVerified: true}
	member := &domain.User{ID: "usr-lt-member", Email: "member@loadtest.dev", IsVerified: true}
	viewer := &domain.User{ID: "usr-lt-viewer", Email: "viewer@loadtest.dev", IsVerified: true}
	outsider := &domain.User{ID: "usr-lt-outsider", Email: "outsider@loadtest.dev", IsVerified: true}

	for _, u := range []*domain.User{owner, admin, member, viewer, outsider} {
		require.NoError(t, rig.userRepo.Create(ctx, u))
	}

	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Load Test Corp",
		Slug: "lt-corp-" + owner.ID,
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
		Name:    "Target API",
		Slug:    "target-api-" + owner.ID,
		BaseURL: "https://api.acme.com",
	})
	require.NoError(t, err)

	// Mark project as verified in repository
	p, err := rig.projectRepo.FindByID(ctx, org.ID, proj.ID)
	require.NoError(t, err)
	p.VerificationStatus = domain.StatusVerified
	require.NoError(t, rig.projectRepo.Update(ctx, p))

	return &loadTestHTTPTestContext{
		rig:         rig,
		orgID:       org.ID,
		projectID:   proj.ID,
		tokens:      tokens,
		outsiderTok: outsiderTok,
	}
}

func TestLoadTestHandler_Create_And_Get(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	reqPayload := domain.CreateLoadTestRequest{
		Name:    "Ramp Up Orders",
		Model:   domain.ModelOpen,
		Profile: domain.ProfileRamp,
		Targets: []domain.TargetItemRequest{
			{
				Method: "POST",
				Path:   "/orders",
				Headers: map[string]string{
					"Authorization": "Bearer sensitive-secret-jwt",
					"Content-Type":  "application/json",
				},
				Weight: 1,
			},
		},
		StartRate:       10,
		PeakRate:        100,
		RampUpSeconds:   30,
		DurationSeconds: 60,
		MaxVirtualUsers: 100,
		TimeoutMS:       2000,
		StartNow:        false, // Draft
	}
	b, _ := json.Marshal(reqPayload)

	// 1. Member creates draft load test
	req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests", tc.orgID, tc.projectID), bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	req.Header.Set("Content-Type", "application/json")

	resp, err := tc.rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(bodyBytes, &res)
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	testID := dataMap["id"].(string)
	assert.NotEmpty(t, testID)
	assert.Equal(t, string(domain.LoadTestStatusDraft), dataMap["status"])

	// 2. Viewer gets test detail
	reqGet := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s", tc.orgID, tc.projectID, testID), nil)
	reqGet.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	respGet, err := tc.rig.app.Test(reqGet)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respGet.StatusCode)

	bodyBytesGet, _ := io.ReadAll(respGet.Body)
	var resGet domain.Response
	_ = json.Unmarshal(bodyBytesGet, &resGet)
	assert.True(t, resGet.Success)

	dataGet := resGet.Data.(map[string]interface{})
	configMap := dataGet["config"].(map[string]interface{})
	targetsSlice := configMap["targets"].([]interface{})
	target0 := targetsSlice[0].(map[string]interface{})
	headersMap := target0["headers"].(map[string]interface{})
	assert.Equal(t, "***", headersMap["Authorization"])
}

func TestLoadTestHandler_List_And_Delete(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// Create test directly in repo
	now := time.Now().UTC()
	testRecord := &domain.LoadTest{
		ID:        "test-to-delete",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "Draft to Delete",
		Model:     domain.ModelOpen,
		Profile:   domain.ProfileSustained,
		Status:    domain.LoadTestStatusDraft,
		CreatedBy: "user-1",
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(context.Background(), testRecord))

	// 1. List
	reqList := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests", tc.orgID, tc.projectID), nil)
	reqList.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	respList, err := tc.rig.app.Test(reqList)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respList.StatusCode)

	// 2. Member tries to delete -> 403 Forbidden (requires admin+)
	reqDelMember := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s", tc.orgID, tc.projectID, testRecord.ID), nil)
	reqDelMember.Header.Set("Authorization", "Bearer "+tc.tokens["member"])

	respDelMember, err := tc.rig.app.Test(reqDelMember)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusForbidden, respDelMember.StatusCode)

	// 3. Admin deletes -> 200 OK
	reqDelAdmin := httptest.NewRequest("DELETE", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s", tc.orgID, tc.projectID, testRecord.ID), nil)
	reqDelAdmin.Header.Set("Authorization", "Bearer "+tc.tokens["admin"])

	respDelAdmin, err := tc.rig.app.Test(reqDelAdmin)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respDelAdmin.StatusCode)
}

func TestLoadTestHandler_Timeseries_And_Results(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()

	now := time.Now().UTC()
	testRecord := &domain.LoadTest{
		ID:        "test-completed",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "Completed Test",
		Model:     domain.ModelOpen,
		Profile:   domain.ProfileSustained,
		Status:    domain.LoadTestStatusCompleted,
		CreatedBy: "user-1",
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, testRecord))

	// Seed timeseries & results
	tsBatch := []*domain.LoadTestTimeseries{
		{ID: "pt-1", TestID: testRecord.ID, Second: 0, OfferedRPS: 20, AchievedRPS: 20, P50: 15, P95: 50, P99: 90},
		{ID: "pt-2", TestID: testRecord.ID, Second: 1, OfferedRPS: 20, AchievedRPS: 20, P50: 16, P95: 55, P99: 95},
	}
	require.NoError(t, tc.rig.loadTestRepo.CreateTimeseriesBatch(ctx, tsBatch))

	res := &domain.LoadTestResults{
		TestID: testRecord.ID,
		Summary: domain.JSONMap{
			"total_requests": 40,
			"successful":     40,
			"avg_rps":        20.0,
		},
		CreatedAt: now,
	}
	require.NoError(t, tc.rig.loadTestRepo.CreateResults(ctx, res))

	// Query Results
	reqRes := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/results", tc.orgID, tc.projectID, testRecord.ID), nil)
	reqRes.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	respRes, err := tc.rig.app.Test(reqRes)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respRes.StatusCode)

	// Query Timeseries
	reqTS := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/timeseries?step=1s", tc.orgID, tc.projectID, testRecord.ID), nil)
	reqTS.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	respTS, err := tc.rig.app.Test(reqTS)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respTS.StatusCode)
}

func TestLoadTestHandler_StreamProgress_SSE(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()

	now := time.Now().UTC()
	testRecord := &domain.LoadTest{
		ID:        "test-sse",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "SSE Stream Test",
		Model:     domain.ModelOpen,
		Profile:   domain.ProfileSustained,
		Status:    domain.LoadTestStatusCompleted, // Completed test will emit snapshot, status, end and close
		CreatedBy: "user-1",
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, testRecord))

	// Close client if topic is open
	go func() {
		topic := fmt.Sprintf("loadtest:%s", testRecord.ID)
		for i := 0; i < 50; i++ {
			time.Sleep(10 * time.Millisecond)
			if tc.rig.sseHub.SubscriberCount(topic) > 0 {
				time.Sleep(30 * time.Millisecond)
				tc.rig.sseHub.CloseTopicClients(topic)
				return
			}
		}
	}()

	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/progress", tc.orgID, tc.projectID, testRecord.ID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	resp, err := tc.rig.app.Test(req, 2000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	assert.Contains(t, resp.Header.Get("Content-Type"), "text/event-stream")

	bodyBytes, _ := io.ReadAll(resp.Body)
	bodyStr := string(bodyBytes)
	assert.Contains(t, bodyStr, "event: snapshot")
	assert.Contains(t, bodyStr, "event: end")
}

func TestLoadTestHandler_RBAC_Matrix(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)

	// Roles permitted to list and view
	viewRoles := []string{"owner", "admin", "member", "viewer"}
	for _, role := range viewRoles {
		t.Run("view_"+role, func(t *testing.T) {
			req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests", tc.orgID, tc.projectID), nil)
			req.Header.Set("Authorization", "Bearer "+tc.tokens[role])

			resp, err := tc.rig.app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		})
	}

	// Outsider blocked (404 per PRD 9.2 multi-tenant defense-in-depth)
	t.Run("outsider_blocked", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests", tc.orgID, tc.projectID), nil)
		req.Header.Set("Authorization", "Bearer "+tc.outsiderTok)

		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})
}
