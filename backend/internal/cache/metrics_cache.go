package cache

import (
	"fmt"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// MetricsCache defines a short-lived result cache (5-15s) for metrics queries.
type MetricsCache interface {
	GetOverview(projectID, queryHash string) (*domain.MetricsOverviewResponse, bool)
	SetOverview(projectID, queryHash string, data *domain.MetricsOverviewResponse, ttl time.Duration)
	GetTimeseries(projectID, queryHash string) (*domain.MetricTimeseriesResponse, bool)
	SetTimeseries(projectID, queryHash string, data *domain.MetricTimeseriesResponse, ttl time.Duration)
	GetStatusCodes(projectID, queryHash string) (*domain.StatusCodesResponse, bool)
	SetStatusCodes(projectID, queryHash string, data *domain.StatusCodesResponse, ttl time.Duration)
	Invalidate(projectID string)
}

type metricsCache struct {
	cache Cache
}

// NewMetricsCache instantiates a metrics cache backed by the underlying memory cache.
func NewMetricsCache(cache Cache) MetricsCache {
	return &metricsCache{cache: cache}
}

func (m *metricsCache) overviewKey(projectID, hash string) string {
	return fmt.Sprintf("metrics:overview:%s:%s", projectID, hash)
}

func (m *metricsCache) timeseriesKey(projectID, hash string) string {
	return fmt.Sprintf("metrics:timeseries:%s:%s", projectID, hash)
}

func (m *metricsCache) statusCodesKey(projectID, hash string) string {
	return fmt.Sprintf("metrics:statuscodes:%s:%s", projectID, hash)
}

func (m *metricsCache) GetOverview(projectID, queryHash string) (*domain.MetricsOverviewResponse, bool) {
	val, ok := m.cache.Get(m.overviewKey(projectID, queryHash))
	if !ok {
		return nil, false
	}
	res, ok := val.(*domain.MetricsOverviewResponse)
	return res, ok
}

func (m *metricsCache) SetOverview(projectID, queryHash string, data *domain.MetricsOverviewResponse, ttl time.Duration) {
	if ttl <= 0 {
		ttl = 10 * time.Second
	}
	m.cache.Set(m.overviewKey(projectID, queryHash), data, ttl)
}

func (m *metricsCache) GetTimeseries(projectID, queryHash string) (*domain.MetricTimeseriesResponse, bool) {
	val, ok := m.cache.Get(m.timeseriesKey(projectID, queryHash))
	if !ok {
		return nil, false
	}
	res, ok := val.(*domain.MetricTimeseriesResponse)
	return res, ok
}

func (m *metricsCache) SetTimeseries(projectID, queryHash string, data *domain.MetricTimeseriesResponse, ttl time.Duration) {
	if ttl <= 0 {
		ttl = 10 * time.Second
	}
	m.cache.Set(m.timeseriesKey(projectID, queryHash), data, ttl)
}

func (m *metricsCache) GetStatusCodes(projectID, queryHash string) (*domain.StatusCodesResponse, bool) {
	val, ok := m.cache.Get(m.statusCodesKey(projectID, queryHash))
	if !ok {
		return nil, false
	}
	res, ok := val.(*domain.StatusCodesResponse)
	return res, ok
}

func (m *metricsCache) SetStatusCodes(projectID, queryHash string, data *domain.StatusCodesResponse, ttl time.Duration) {
	if ttl <= 0 {
		ttl = 10 * time.Second
	}
	m.cache.Set(m.statusCodesKey(projectID, queryHash), data, ttl)
}

func (m *metricsCache) Invalidate(projectID string) {
	// Simple invalidation if needed
	m.cache.Delete(m.overviewKey(projectID, "*"))
}
