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

func TestCapacityHandler_GetCapacityReport(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()

	// 1. Setup completed load test
	test := &domain.LoadTest{
		ID:        "test-cap-1",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "Capacity Verified Run",
		Model:     domain.ModelOpen,
		Profile:   domain.ProfileStep,
		Status:    domain.LoadTestStatusCompleted,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, test))

	breakingRPS := 300.0
	reason := domain.BreakingReasonLatency
	report := &domain.CapacityReport{
		ID:               "cap-rep-1",
		LoadTestID:       "test-cap-1",
		OrgID:            tc.orgID,
		ProjectID:        tc.projectID,
		SustainableRPS:   250.0,
		BreakingPointRPS: &breakingRPS,
		BreakingReason:   &reason,
		BaselineP95Ms:    22.5,
		Confidence:       domain.ConfidenceHigh,
		Note:             "Found clean breaking point",
		Thresholds: domain.CapacityThresholds{
			P95Multiplier:    2.0,
			MaxErrorRate:     0.01,
			MinAchievedRatio: 0.95,
		},
		Windows: []domain.CapacityWindow{
			{Index: 1, StartSecond: 0, EndSecond: 10, OfferedRPS: 100, AchievedRPS: 100, P95Ms: 20, Healthy: true},
			{Index: 2, StartSecond: 10, EndSecond: 20, OfferedRPS: 250, AchievedRPS: 250, P95Ms: 30, Healthy: true},
			{Index: 3, StartSecond: 20, EndSecond: 30, OfferedRPS: 300, AchievedRPS: 295, P95Ms: 75, Healthy: false, FailureReason: &reason},
		},
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	require.NoError(t, tc.rig.capRepo.Save(ctx, report))

	// Viewer queries report -> 200 OK
	req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity", tc.orgID, tc.projectID, test.ID), nil)
	req.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	resp, err := tc.rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	require.NoError(t, json.Unmarshal(bodyBytes, &res))
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	assert.Equal(t, "test-cap-1", dataMap["load_test_id"])
	assert.Equal(t, 250.0, dataMap["sustainable_rps"])
	assert.Equal(t, 300.0, dataMap["breaking_point_rps"])
	assert.Equal(t, domain.ConfidenceHigh, dataMap["confidence"])

	// 2. Active running test -> 409 Conflict (TEST_NOT_FINISHED)
	runningTest := &domain.LoadTest{
		ID:        "test-cap-running",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "In Flight Run",
		Status:    domain.LoadTestStatusRunning,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, runningTest))

	reqRunning := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity", tc.orgID, tc.projectID, runningTest.ID), nil)
	reqRunning.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])

	respRunning, err := tc.rig.app.Test(reqRunning)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusConflict, respRunning.StatusCode)
}

func TestCapacityHandler_RecomputeCapacity(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()

	test := &domain.LoadTest{
		ID:        "test-recompute-http",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "Recompute HTTP Run",
		Status:    domain.LoadTestStatusCompleted,
		Profile:   domain.ProfileStep,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, test))

	var tsList []*domain.LoadTestTimeseries
	for i := 0; i < 20; i++ {
		tsList = append(tsList, &domain.LoadTestTimeseries{
			ID:          "ts-rec-h",
			TestID:      "test-recompute-http",
			Second:      i,
			OfferedRPS:  float64(50 + i*10),
			AchievedRPS: float64(50 + i*10),
			P95:         15.0,
		})
	}
	require.NoError(t, tc.rig.loadTestRepo.CreateTimeseriesBatch(ctx, tsList))

	recomputeReq := domain.RecomputeCapacityRequest{
		Thresholds: &domain.CapacityThresholds{
			P95Multiplier:    3.0,
			MaxErrorRate:     0.02,
			MinAchievedRatio: 0.90,
		},
		Save: true,
	}
	b, _ := json.Marshal(recomputeReq)

	// Member recomputes capacity -> 200 OK
	req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity/recompute", tc.orgID, tc.projectID, test.ID), bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+tc.tokens["member"])
	req.Header.Set("Content-Type", "application/json")

	resp, err := tc.rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	require.NoError(t, json.Unmarshal(bodyBytes, &res))
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	assert.Equal(t, "test-recompute-http", dataMap["load_test_id"])

	// Viewer blocked from recomputing -> 403 Forbidden
	reqViewer := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity/recompute", tc.orgID, tc.projectID, test.ID), bytes.NewReader(b))
	reqViewer.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	reqViewer.Header.Set("Content-Type", "application/json")

	respViewer, err := tc.rig.app.Test(reqViewer)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusForbidden, respViewer.StatusCode)
}

func TestCapacityHandler_CompareLoadTests(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()

	// Create 2 completed tests
	t1 := &domain.LoadTest{ID: "cmp-t1", OrgID: tc.orgID, ProjectID: tc.projectID, Name: "v1.0 Baseline", Status: domain.LoadTestStatusCompleted}
	t2 := &domain.LoadTest{ID: "cmp-t2", OrgID: tc.orgID, ProjectID: tc.projectID, Name: "v1.1 Optimized", Status: domain.LoadTestStatusCompleted}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, t1))
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, t2))

	s1, _ := json.Marshal(domain.LoadTestSummary{AvgRPS: 200, PeakRPS: 300, LatencyMS: domain.LoadTestLatencySummary{P95: 100}, ErrorRate: 0.01})
	s2, _ := json.Marshal(domain.LoadTestSummary{AvgRPS: 240, PeakRPS: 350, LatencyMS: domain.LoadTestLatencySummary{P95: 60}, ErrorRate: 0.005})
	var m1, m2 domain.JSONMap
	_ = json.Unmarshal(s1, &m1)
	_ = json.Unmarshal(s2, &m2)

	_ = tc.rig.loadTestRepo.CreateResults(ctx, &domain.LoadTestResults{TestID: "cmp-t1", Summary: m1})
	_ = tc.rig.loadTestRepo.CreateResults(ctx, &domain.LoadTestResults{TestID: "cmp-t2", Summary: m2})

	_ = tc.rig.capRepo.Save(ctx, &domain.CapacityReport{ID: "cr1", LoadTestID: "cmp-t1", ProjectID: tc.projectID, SustainableRPS: 200})
	_ = tc.rig.capRepo.Save(ctx, &domain.CapacityReport{ID: "cr2", LoadTestID: "cmp-t2", ProjectID: tc.projectID, SustainableRPS: 250})

	comparePayload := domain.CompareLoadTestsRequest{
		TestIDs:    []string{"cmp-t1", "cmp-t2"},
		BaselineID: "cmp-t1",
	}
	b, _ := json.Marshal(comparePayload)

	// Viewer executes comparison -> 200 OK
	req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/compare", tc.orgID, tc.projectID), bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+tc.tokens["viewer"])
	req.Header.Set("Content-Type", "application/json")

	resp, err := tc.rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	bodyBytes, _ := io.ReadAll(resp.Body)
	var res domain.Response
	require.NoError(t, json.Unmarshal(bodyBytes, &res))
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	assert.Equal(t, "cmp-t1", dataMap["baseline_id"])

	testsList := dataMap["tests"].([]interface{})
	assert.Len(t, testsList, 2)

	deltas := dataMap["deltas"].([]interface{})
	assert.Len(t, deltas, 1)

	deltaObj := deltas[0].(map[string]interface{})
	assert.Equal(t, "cmp-t2", deltaObj["test_id"])
	assert.Equal(t, 20.0, deltaObj["avg_rps_pct"])
	assert.Equal(t, -40.0, deltaObj["p95_pct"]) // 100 -> 60 is -40%
	assert.Equal(t, domain.VerdictImproved, deltaObj["verdict"])
}

func TestCapacityHandler_RBAC_Matrix(t *testing.T) {
	tc := setupLoadTestHTTPContext(t)
	ctx := context.Background()

	test := &domain.LoadTest{
		ID:        "test-rbac-cap",
		OrgID:     tc.orgID,
		ProjectID: tc.projectID,
		Name:      "RBAC Test",
		Status:    domain.LoadTestStatusCompleted,
	}
	require.NoError(t, tc.rig.loadTestRepo.Create(ctx, test))
	require.NoError(t, tc.rig.capRepo.Save(ctx, &domain.CapacityReport{
		ID:             "cap-rbac",
		LoadTestID:     "test-rbac-cap",
		ProjectID:      tc.projectID,
		SustainableRPS: 100,
	}))

	// Recompute body
	recompBody, _ := json.Marshal(domain.RecomputeCapacityRequest{Save: false})

	// 1. GET /capacity (Viewer+)
	for role, expectedCode := range map[string]int{
		"owner":  fiber.StatusOK,
		"admin":  fiber.StatusOK,
		"member": fiber.StatusOK,
		"viewer": fiber.StatusOK,
	} {
		req := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity", tc.orgID, tc.projectID, test.ID), nil)
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, expectedCode, resp.StatusCode, "GET capacity for role %s", role)
	}

	// 2. POST /capacity/recompute (Member+)
	for role, expectedCode := range map[string]int{
		"owner":  fiber.StatusOK,
		"admin":  fiber.StatusOK,
		"member": fiber.StatusOK,
		"viewer": fiber.StatusForbidden,
	} {
		req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity/recompute", tc.orgID, tc.projectID, test.ID), bytes.NewReader(recompBody))
		req.Header.Set("Authorization", "Bearer "+tc.tokens[role])
		req.Header.Set("Content-Type", "application/json")
		resp, err := tc.rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, expectedCode, resp.StatusCode, "POST recompute for role %s", role)
	}

	// 3. Outsider isolation -> 404 Not Found on all capacity endpoints (never leaking tenant existence)
	reqOutsiderGet := httptest.NewRequest("GET", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity", tc.orgID, tc.projectID, test.ID), nil)
	reqOutsiderGet.Header.Set("Authorization", "Bearer "+tc.outsiderTok)
	respOutsiderGet, err := tc.rig.app.Test(reqOutsiderGet)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, respOutsiderGet.StatusCode)

	reqOutsiderRecomp := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects/%s/load-tests/%s/capacity/recompute", tc.orgID, tc.projectID, test.ID), bytes.NewReader(recompBody))
	reqOutsiderRecomp.Header.Set("Authorization", "Bearer "+tc.outsiderTok)
	reqOutsiderRecomp.Header.Set("Content-Type", "application/json")
	respOutsiderRecomp, err := tc.rig.app.Test(reqOutsiderRecomp)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, respOutsiderRecomp.StatusCode)
}
