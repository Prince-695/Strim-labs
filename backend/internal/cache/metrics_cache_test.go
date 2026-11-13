package cache_test

import (
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMetricsCache(t *testing.T) {
	mem := cache.NewMemoryCache()
	mc := cache.NewMetricsCache(mem)

	projID := "proj-123"
	queryHash := "hash-abc"

	// 1. Overview Cache
	_, ok := mc.GetOverview(projID, queryHash)
	assert.False(t, ok)

	overview := &domain.MetricsOverviewResponse{
		Current: domain.MetricSummary{RPS: 42.5},
	}
	mc.SetOverview(projID, queryHash, overview, 5*time.Second)

	cachedOverview, ok := mc.GetOverview(projID, queryHash)
	require.True(t, ok)
	assert.Equal(t, 42.5, cachedOverview.Current.RPS)

	// 2. Timeseries Cache
	_, ok = mc.GetTimeseries(projID, queryHash)
	assert.False(t, ok)

	ts := &domain.MetricTimeseriesResponse{
		Metric: "rps",
		Series: []domain.TimeseriesSeries{{Key: "all"}},
	}
	mc.SetTimeseries(projID, queryHash, ts, 5*time.Second)

	cachedTS, ok := mc.GetTimeseries(projID, queryHash)
	require.True(t, ok)
	assert.Equal(t, "rps", cachedTS.Metric)

	// 3. Status Codes Cache
	_, ok = mc.GetStatusCodes(projID, queryHash)
	assert.False(t, ok)

	sc := &domain.StatusCodesResponse{
		Classes: map[string]int64{"2xx": 100},
	}
	mc.SetStatusCodes(projID, queryHash, sc, 5*time.Second)

	cachedSC, ok := mc.GetStatusCodes(projID, queryHash)
	require.True(t, ok)
	assert.Equal(t, int64(100), cachedSC.Classes["2xx"])

	// 4. Invalidate
	mc.Invalidate(projID)
}
