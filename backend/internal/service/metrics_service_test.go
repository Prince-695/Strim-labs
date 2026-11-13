package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type metricsTestRig struct {
	svc          service.MetricsService
	store        *ingest.InMemoryTimeSeriesStore
	projectRepo  *repository.InMemoryProjectRepository
	endpointRepo *repository.InMemoryEndpointRepository
	clk          *clock.MockClock
	projectID    string
	endpointID   string
}

func setupMetricsTestRig(t *testing.T) *metricsTestRig {
	fixedNow := time.Date(2026, 11, 13, 14, 0, 0, 0, time.UTC)
	clk := clock.NewMockClock(fixedNow)

	store := ingest.NewInMemoryTimeSeriesStore()
	projectRepo := repository.NewInMemoryProjectRepository()
	endpointRepo := repository.NewInMemoryEndpointRepository()
	memCache := cache.NewMemoryCache()
	mCache := cache.NewMetricsCache(memCache)

	projID := "proj-metrics-1"
	err := projectRepo.CreateWithLimitCheck(context.Background(), &domain.Project{
		ID:        projID,
		OrgID:     "org-1",
		Name:      "Metrics Test",
		Slug:      "metrics-test",
		BaseURL:   "https://api.example.com",
		CreatedAt: fixedNow,
		UpdatedAt: fixedNow,
	})
	require.NoError(t, err)

	ep, _, err := endpointRepo.UpsertRoute(context.Background(), projID, discovery.DiscoveredRoute{
		Method:       "GET",
		PathTemplate: "/orders/{id}",
		Service:      "orders",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	svc := service.NewMetricsService(store, endpointRepo, projectRepo, mCache, clk)

	return &metricsTestRig{
		svc:          svc,
		store:        store,
		projectRepo:  projectRepo,
		endpointRepo: endpointRepo,
		clk:          clk,
		projectID:    projID,
		endpointID:   ep.ID,
	}
}

func TestMetricsService_ParseTimeRange(t *testing.T) {
	now := time.Date(2026, 11, 13, 12, 0, 0, 0, time.UTC)
	clk := clock.NewMockClock(now)

	// 1. Relative ranges
	tr15m, err := service.ParseTimeRange(clk, "15m", "", "", "")
	require.NoError(t, err)
	assert.Equal(t, 15*time.Minute, tr15m.Duration)
	assert.Equal(t, 10*time.Second, tr15m.Step)

	tr1h, err := service.ParseTimeRange(clk, "1h", "", "", "")
	require.NoError(t, err)
	assert.Equal(t, 1*time.Hour, tr1h.Duration)
	assert.Equal(t, 1*time.Minute, tr1h.Step)

	tr24h, err := service.ParseTimeRange(clk, "24h", "", "", "")
	require.NoError(t, err)
	assert.Equal(t, 24*time.Hour, tr24h.Duration)
	assert.Equal(t, 5*time.Minute, tr24h.Step)

	// 2. Explicit from/to
	fromStr := "2026-11-13T10:00:00Z"
	toStr := "2026-11-13T12:00:00Z"
	trExplicit, err := service.ParseTimeRange(clk, "", fromStr, toStr, "5m")
	require.NoError(t, err)
	assert.Equal(t, 2*time.Hour, trExplicit.Duration)
	assert.Equal(t, 5*time.Minute, trExplicit.Step)

	// 3. Invalid to <= from
	_, err = service.ParseTimeRange(clk, "", toStr, fromStr, "")
	require.Error(t, err)
}

func TestMetricsService_GetOverview_MultiTier(t *testing.T) {
	rig := setupMetricsTestRig(t)
	now := rig.clk.Now()

	// Tier 1: Raw events (within last 15m)
	events := []domain.RequestEvent{
		{
			ProjectID:  rig.projectID,
			Timestamp:  now.Add(-5 * time.Minute),
			Method:     "GET",
			Route:      "/orders/{id}",
			Status:     200,
			DurationMs: 40.0,
		},
		{
			ProjectID:  rig.projectID,
			Timestamp:  now.Add(-2 * time.Minute),
			Method:     "GET",
			Route:      "/orders/{id}",
			Status:     500,
			DurationMs: 120.0,
			IsError:    true,
		},
	}
	err := rig.store.WriteEvents(context.Background(), events)
	require.NoError(t, err)

	overview15m, err := rig.svc.GetOverview(context.Background(), rig.projectID, service.MetricsQuery{
		Range: "15m",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), overview15m.Current.Requests)
	assert.Equal(t, 0.5, overview15m.Current.ErrorRate)
	assert.InDelta(t, 40.0, overview15m.Current.P50, 10.0)

	// Tier 2: 1m Rollups (24h window)
	h := histogram.NewHistogram()
	h.Add(25.0)
	h.Add(35.0)
	rollup1m := domain.RequestRollup1m{
		ID:           "r1m-1",
		ProjectID:    rig.projectID,
		EndpointKey:  "GET /orders/{id}",
		Bucket:       now.Add(-2 * time.Hour),
		Count:        2,
		Errors:       0,
		SumMs:        60.0,
		MinMs:        25.0,
		MaxMs:        35.0,
		Histogram:    h.ToBytes(),
		StatusCounts: domain.JSONMap{"200": int64(2)},
	}
	err = rig.store.WriteRollups1m(context.Background(), []domain.RequestRollup1m{rollup1m})
	require.NoError(t, err)

	overview24h, err := rig.svc.GetOverview(context.Background(), rig.projectID, service.MetricsQuery{
		Range: "24h",
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), overview24h.Current.Requests)
	assert.Equal(t, 0.0, overview24h.Current.ErrorRate)
}

func TestMetricsService_GetTimeseries_NullBuckets(t *testing.T) {
	rig := setupMetricsTestRig(t)
	now := rig.clk.Now()

	// Only 1 event in a 15-minute window with 10s steps (most buckets should be null)
	events := []domain.RequestEvent{
		{
			ProjectID:  rig.projectID,
			Timestamp:  now.Add(-30 * time.Second),
			Method:     "GET",
			Route:      "/orders/{id}",
			Status:     200,
			DurationMs: 50.0,
		},
	}
	err := rig.store.WriteEvents(context.Background(), events)
	require.NoError(t, err)

	tsResp, err := rig.svc.GetTimeseries(context.Background(), rig.projectID, service.TimeseriesQuery{
		MetricsQuery: service.MetricsQuery{Range: "15m"},
		Metric:       "rps",
	})
	require.NoError(t, err)
	require.Equal(t, 1, len(tsResp.Series))
	series := tsResp.Series[0]
	assert.Equal(t, "all", series.Key)

	// Check that we have multiple points and empty ones have null Value
	var hasNonNull, hasNull bool
	for _, p := range series.Points {
		if p.Value != nil {
			hasNonNull = true
		} else {
			hasNull = true
		}
	}
	assert.True(t, hasNonNull, "Should have at least 1 non-null point")
	assert.True(t, hasNull, "Missing buckets must be null per API spec 10.2")
}

func TestMetricsService_GetEndpointsMetrics_Health(t *testing.T) {
	rig := setupMetricsTestRig(t)

	// Add failing endpoint
	_, _, err := rig.endpointRepo.UpsertRoute(context.Background(), rig.projectID, discovery.DiscoveredRoute{
		Method:       "POST",
		PathTemplate: "/payments/fail",
		Service:      "payments",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	now := rig.clk.Now()
	events := []domain.RequestEvent{
		{
			ProjectID:  rig.projectID,
			Timestamp:  now.Add(-1 * time.Minute),
			Method:     "POST",
			Route:      "/payments/fail",
			Status:     500,
			DurationMs: 2500.0,
			IsError:    true,
		},
	}
	err = rig.store.WriteEvents(context.Background(), events)
	require.NoError(t, err)

	res, err := rig.svc.GetEndpointsMetrics(context.Background(), rig.projectID, service.EndpointsMetricsQuery{
		MetricsQuery: service.MetricsQuery{Range: "15m"},
		Sort:         "-requests",
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(res))

	var failEp *domain.EndpointMetricItem
	var emptyEp *domain.EndpointMetricItem
	for _, item := range res {
		if item.PathTemplate == "/payments/fail" {
			failEp = item
		} else {
			emptyEp = item
		}
	}

	require.NotNil(t, failEp)
	assert.Equal(t, domain.HealthFailing, failEp.Health)
	assert.Equal(t, int64(1), failEp.Requests)
	assert.Equal(t, 1.0, failEp.ErrorRate)

	require.NotNil(t, emptyEp)
	assert.Equal(t, domain.HealthNoData, emptyEp.Health)
}

func TestMetricsService_GetStatusCodes(t *testing.T) {
	rig := setupMetricsTestRig(t)
	now := rig.clk.Now()

	events := []domain.RequestEvent{
		{ProjectID: rig.projectID, Timestamp: now.Add(-1 * time.Minute), Method: "GET", Route: "/a", Status: 200, DurationMs: 10},
		{ProjectID: rig.projectID, Timestamp: now.Add(-1 * time.Minute), Method: "GET", Route: "/a", Status: 200, DurationMs: 10},
		{ProjectID: rig.projectID, Timestamp: now.Add(-1 * time.Minute), Method: "GET", Route: "/a", Status: 404, DurationMs: 10},
		{ProjectID: rig.projectID, Timestamp: now.Add(-1 * time.Minute), Method: "GET", Route: "/a", Status: 500, DurationMs: 10, IsError: true},
	}
	err := rig.store.WriteEvents(context.Background(), events)
	require.NoError(t, err)

	resp, err := rig.svc.GetStatusCodes(context.Background(), rig.projectID, service.MetricsQuery{Range: "15m"})
	require.NoError(t, err)
	assert.Equal(t, int64(2), resp.Classes["2xx"])
	assert.Equal(t, int64(1), resp.Classes["4xx"])
	assert.Equal(t, int64(1), resp.Classes["5xx"])
	assert.Equal(t, 3, len(resp.Codes)) // status 200, 404, 500
}

func TestMetricsService_GetHostsMetrics(t *testing.T) {
	rig := setupMetricsTestRig(t)
	resp, err := rig.svc.GetHostsMetrics(context.Background(), rig.projectID, service.HostsMetricsQuery{
		Host:   "node-1",
		Metric: "cpu",
	})
	require.NoError(t, err)
	assert.False(t, resp.Connected)
	assert.Empty(t, resp.Series)
}
