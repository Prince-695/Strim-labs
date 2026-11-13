package service_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type diagnosticsTestHarness struct {
	svc          service.DiagnosticsService
	store        ingest.TimeSeriesStore
	endpointRepo repository.EndpointRepository
	loadTestRepo repository.LoadTestRepository
	projectRepo  repository.ProjectRepository
	clk          *clock.MockClock
}

func setupDiagnosticsHarness(t *testing.T) *diagnosticsTestHarness {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	mockClk := clock.NewMockClock(now)

	store := ingest.NewInMemoryTimeSeriesStore()
	endpointRepo := repository.NewInMemoryEndpointRepository()
	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	projectRepo := repository.NewInMemoryProjectRepository()

	// Create test project in repo
	ctx := context.Background()
	proj := &domain.Project{
		ID:        "proj-diag",
		OrgID:     "org-diag",
		Name:      "Diagnostics API",
		Slug:      "diag-api",
		BaseURL:   "https://api.strimlabs.dev",
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, projectRepo.CreateWithLimitCheck(ctx, proj))

	// Register an endpoint
	ep, _, err := endpointRepo.UpsertRoute(ctx, "proj-diag", discovery.DiscoveredRoute{
		Method:       "POST",
		PathTemplate: "/checkout",
		Service:      "orders-svc",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)
	require.NotEmpty(t, ep.ID)

	svc := service.NewDiagnosticsService(store, endpointRepo, loadTestRepo, projectRepo, mockClk)

	return &diagnosticsTestHarness{
		svc:          svc,
		store:        store,
		endpointRepo: endpointRepo,
		loadTestRepo: loadTestRepo,
		projectRepo:  projectRepo,
		clk:          mockClk,
	}
}

func TestDiagnosticsService_GetSlowEndpoints(t *testing.T) {
	h := setupDiagnosticsHarness(t)
	ctx := context.Background()
	now := h.clk.Now()

	// Ingest events:
	// Endpoint A (/checkout): 50 requests @ 200ms -> ImpactScore = 50 * 200 = 10,000
	// Endpoint B (/catalog): 15 requests @ 300ms -> ImpactScore = 15 * 300 = 4,500
	// Endpoint C (/health): 5 requests @ 500ms -> Filtered out (requests < minRequests 10)
	var events []domain.RequestEvent
	for i := 0; i < 50; i++ {
		events = append(events, domain.RequestEvent{
			ProjectID:  "proj-diag",
			Method:     "POST",
			Route:      "/checkout",
			Service:    "orders-svc",
			Status:     200,
			DurationMs: 200.0,
			Timestamp:  now.Add(-5 * time.Minute),
		})
	}
	for i := 0; i < 15; i++ {
		events = append(events, domain.RequestEvent{
			ProjectID:  "proj-diag",
			Method:     "GET",
			Route:      "/catalog",
			Service:    "catalog-svc",
			Status:     200,
			DurationMs: 300.0,
			Timestamp:  now.Add(-5 * time.Minute),
		})
	}
	for i := 0; i < 5; i++ {
		events = append(events, domain.RequestEvent{
			ProjectID:  "proj-diag",
			Method:     "GET",
			Route:      "/health",
			Status:     200,
			DurationMs: 500.0,
			Timestamp:  now.Add(-5 * time.Minute),
		})
	}
	require.NoError(t, h.store.WriteEvents(ctx, events))

	resp, err := h.svc.GetSlowEndpoints(ctx, "proj-diag", domain.SlowEndpointsQuery{
		Range:       "1h",
		MinRequests: 10,
		Limit:       10,
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "1h", resp.Range)
	assert.Equal(t, 2, resp.TotalEvaluated) // /health is filtered out
	require.Len(t, resp.Endpoints, 2)

	// #1 is /checkout because its volume-weighted impact score (10,000) > /catalog (4,500)
	top := resp.Endpoints[0]
	assert.Equal(t, "POST", top.Method)
	assert.Equal(t, "/checkout", top.Route)
	assert.Equal(t, "orders-svc", top.Service)
	assert.Equal(t, int64(50), top.Requests)
	assert.Equal(t, 10000.0, top.ImpactScore)
	assert.NotEmpty(t, top.EndpointID)

	second := resp.Endpoints[1]
	assert.Equal(t, "GET", second.Method)
	assert.Equal(t, "/catalog", second.Route)
	assert.Equal(t, 4500.0, second.ImpactScore)
}

func TestDiagnosticsService_GetRegressions(t *testing.T) {
	h := setupDiagnosticsHarness(t)
	ctx := context.Background()
	now := h.clk.Now()

	// 1. Baseline "previous":
	// In previous window (now-2h to now-1h): /checkout was 50ms P95, 0% error rate
	// In current window (now-1h to now): /checkout is 120ms P95 (+140%), 6% error rate
	var baseEvents []domain.RequestEvent
	for i := 0; i < 20; i++ {
		baseEvents = append(baseEvents, domain.RequestEvent{
			ProjectID:  "proj-diag",
			Method:     "POST",
			Route:      "/checkout",
			Status:     200,
			DurationMs: 50.0,
			Timestamp:  now.Add(-90 * time.Minute), // previous window
		})
	}
	require.NoError(t, h.store.WriteEvents(ctx, baseEvents))

	var curEvents []domain.RequestEvent
	for i := 0; i < 50; i++ {
		status := 200
		if i < 3 {
			status = 500 // 3/50 = 6% errors
		}
		curEvents = append(curEvents, domain.RequestEvent{
			ProjectID:  "proj-diag",
			Method:     "POST",
			Route:      "/checkout",
			Status:     status,
			DurationMs: 120.0,
			Timestamp:  now.Add(-20 * time.Minute), // current window
		})
	}
	require.NoError(t, h.store.WriteEvents(ctx, curEvents))

	resp, err := h.svc.GetRegressions(ctx, "proj-diag", domain.RegressionsQuery{
		Range:        "1h",
		Baseline:     "previous",
		ThresholdPct: 10.0,
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "previous", resp.Baseline)
	require.Len(t, resp.Regressions, 2) // latency regression + error rate regression

	// Latency regression: 50ms -> 120ms (+140%) -> critical
	latReg := resp.Regressions[0]
	assert.Equal(t, "p95_latency", latReg.Metric)
	assert.Equal(t, 50.0, latReg.BaselineValue)
	assert.Equal(t, 120.0, latReg.CurrentValue)
	assert.Equal(t, 140.0, latReg.ChangePct)
	assert.Equal(t, domain.RegressionSeverityCritical, latReg.Severity)

	// Error rate regression: 0% -> 6% (+6 percentage points) -> critical
	errReg := resp.Regressions[1]
	assert.Equal(t, "error_rate", errReg.Metric)
	assert.Equal(t, domain.RegressionSeverityCritical, errReg.Severity)

	// 2. Baseline "test:{id}":
	loadTest := &domain.LoadTest{
		ID:        "test-base-1",
		ProjectID: "proj-diag",
		OrgID:     "org-diag",
		Status:    domain.LoadTestStatusCompleted,
	}
	require.NoError(t, h.loadTestRepo.Create(ctx, loadTest))

	perEpList := []domain.PerEndpointResult{
		{
			Method:    "POST",
			Path:      "/checkout",
			Requests:  1000,
			ErrorRate: 0.01,
			LatencyMS: domain.LoadTestLatencySummary{P95: 60.0},
		},
	}
	perEpBytes, _ := json.Marshal(map[string]interface{}{"items": perEpList})
	var perEpJSON domain.JSONMap
	_ = json.Unmarshal(perEpBytes, &perEpJSON)

	require.NoError(t, h.loadTestRepo.CreateResults(ctx, &domain.LoadTestResults{
		TestID:      "test-base-1",
		PerEndpoint: perEpJSON,
		CreatedAt:   now,
	}))

	respTestBase, err := h.svc.GetRegressions(ctx, "proj-diag", domain.RegressionsQuery{
		Range:        "1h",
		Baseline:     "test:test-base-1",
		ThresholdPct: 10.0,
	})
	require.NoError(t, err)
	require.NotNil(t, respTestBase)
	assert.Equal(t, "test:test-base-1", respTestBase.Baseline)
	require.NotEmpty(t, respTestBase.Regressions)
	assert.Equal(t, 60.0, respTestBase.Regressions[0].BaselineValue)
	assert.Equal(t, 120.0, respTestBase.Regressions[0].CurrentValue)
	assert.Equal(t, 100.0, respTestBase.Regressions[0].ChangePct) // 60 -> 120 is +100%

	// 3. Error case: non-existent load test
	_, err = h.svc.GetRegressions(ctx, "proj-diag", domain.RegressionsQuery{
		Baseline: "test:non-existent",
	})
	assert.Error(t, err)

	// 4. Error case: invalid baseline
	_, err = h.svc.GetRegressions(ctx, "proj-diag", domain.RegressionsQuery{
		Baseline: "invalid-syntax",
	})
	assert.Error(t, err)
}

func TestDiagnosticsService_GetBottlenecks(t *testing.T) {
	h := setupDiagnosticsHarness(t)
	ctx := context.Background()
	now := h.clk.Now()

	// Generate events demonstrating:
	// 1. High execution concentration on /heavy (90% of duration)
	// 2. Tail latency dispersion on /heavy (P50 = 20ms, P99 = 200ms -> ratio 10x)
	// 3. 5xx error surge (10% of total requests)
	var events []domain.RequestEvent
	for i := 0; i < 30; i++ {
		dur := 20.0
		if i >= 28 {
			dur = 200.0 // tail spike
		}
		status := 200
		if i < 3 {
			status = 500 // 10% errors
		}
		events = append(events, domain.RequestEvent{
			ProjectID:  "proj-diag",
			Method:     "POST",
			Route:      "/heavy",
			Status:     status,
			DurationMs: dur,
			Timestamp:  now.Add(-10 * time.Minute),
		})
	}
	// Small lightweight endpoint taking 1ms
	for i := 0; i < 10; i++ {
		events = append(events, domain.RequestEvent{
			ProjectID:  "proj-diag",
			Method:     "GET",
			Route:      "/fast",
			Status:     200,
			DurationMs: 1.0,
			Timestamp:  now.Add(-10 * time.Minute),
		})
	}
	require.NoError(t, h.store.WriteEvents(ctx, events))

	resp, err := h.svc.GetBottlenecks(ctx, "proj-diag", "1h")
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "1h", resp.Range)
	require.NotEmpty(t, resp.Hints)

	hintTypes := make(map[string]domain.BottleneckHint)
	for _, hint := range resp.Hints {
		assert.Equal(t, "hint", hint.Kind)
		assert.NotEmpty(t, hint.Confidence)
		assert.NotEmpty(t, hint.Message)
		assert.NotEmpty(t, hint.Evidence)
		hintTypes[hint.Type] = hint
	}

	// Verify high execution concentration detected
	assert.Contains(t, hintTypes, domain.BottleneckTypeHighExecutionConcentration)

	// Verify tail latency dispersion detected
	assert.Contains(t, hintTypes, domain.BottleneckTypeTailLatencyDispersion)

	// Verify load correlated errors detected
	assert.Contains(t, hintTypes, domain.BottleneckTypeLoadCorrelatedErrors)
}
