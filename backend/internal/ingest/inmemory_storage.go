package ingest

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// InMemoryTimeSeriesStore provides a thread-safe in-memory implementation of TimeSeriesStore.
type InMemoryTimeSeriesStore struct {
	mu        sync.RWMutex
	events    []domain.RequestEvent
	nextID    int64
	rollups1m map[string]domain.RequestRollup1m
	rollups1h map[string]domain.RequestRollup1h
}

// NewInMemoryTimeSeriesStore initializes a new thread-safe in-memory store.
func NewInMemoryTimeSeriesStore() *InMemoryTimeSeriesStore {
	return &InMemoryTimeSeriesStore{
		events:    make([]domain.RequestEvent, 0),
		nextID:    1,
		rollups1m: make(map[string]domain.RequestRollup1m),
		rollups1h: make(map[string]domain.RequestRollup1h),
	}
}

func rollupKey(projectID, endpointKey string, bucket time.Time) string {
	return fmt.Sprintf("%s|%s|%s", projectID, endpointKey, bucket.UTC().Format(time.RFC3339))
}

// WriteEvents saves raw events into in-memory store.
func (m *InMemoryTimeSeriesStore) WriteEvents(ctx context.Context, events []domain.RequestEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, e := range events {
		if e.ID == 0 {
			e.ID = m.nextID
			m.nextID++
		}
		m.events = append(m.events, e)
	}
	return nil
}

// QueryEvents retrieves events matching projectID and time boundaries.
func (m *InMemoryTimeSeriesStore) QueryEvents(ctx context.Context, projectID string, start, end time.Time, limit int) ([]domain.RequestEvent, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if limit <= 0 || limit > 10000 {
		limit = 1000
	}

	var matched []domain.RequestEvent
	for _, e := range m.events {
		if projectID != "" && e.ProjectID != projectID {
			continue
		}
		if !start.IsZero() && e.Timestamp.Before(start) {
			continue
		}
		if !end.IsZero() && e.Timestamp.After(end) {
			continue
		}
		matched = append(matched, e)
	}

	// Sort descending by timestamp
	sort.Slice(matched, func(i, j int) bool {
		return matched[i].Timestamp.After(matched[j].Timestamp)
	})

	if len(matched) > limit {
		matched = matched[:limit]
	}

	return matched, nil
}

// WriteRollups1m upserts 1-minute rollups in memory.
func (m *InMemoryTimeSeriesStore) WriteRollups1m(ctx context.Context, rollups []domain.RequestRollup1m) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, r := range rollups {
		k := rollupKey(r.ProjectID, r.EndpointKey, r.Bucket)
		m.rollups1m[k] = r
	}
	return nil
}

// WriteRollups1h upserts 1-hour rollups in memory.
func (m *InMemoryTimeSeriesStore) WriteRollups1h(ctx context.Context, rollups []domain.RequestRollup1h) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, r := range rollups {
		k := rollupKey(r.ProjectID, r.EndpointKey, r.Bucket)
		m.rollups1h[k] = r
	}
	return nil
}

// QueryRollups1m retrieves 1-minute rollups for an endpoint.
func (m *InMemoryTimeSeriesStore) QueryRollups1m(ctx context.Context, projectID, endpointKey string, start, end time.Time) ([]domain.RequestRollup1m, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []domain.RequestRollup1m
	for _, r := range m.rollups1m {
		if projectID != "" && r.ProjectID != projectID {
			continue
		}
		if endpointKey != "" && r.EndpointKey != endpointKey {
			continue
		}
		if !start.IsZero() && r.Bucket.Before(start) {
			continue
		}
		if !end.IsZero() && r.Bucket.After(end) {
			continue
		}
		results = append(results, r)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Bucket.Before(results[j].Bucket)
	})

	return results, nil
}

// QueryRollups1h retrieves 1-hour rollups for an endpoint.
func (m *InMemoryTimeSeriesStore) QueryRollups1h(ctx context.Context, projectID, endpointKey string, start, end time.Time) ([]domain.RequestRollup1h, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var results []domain.RequestRollup1h
	for _, r := range m.rollups1h {
		if projectID != "" && r.ProjectID != projectID {
			continue
		}
		if endpointKey != "" && r.EndpointKey != endpointKey {
			continue
		}
		if !start.IsZero() && r.Bucket.Before(start) {
			continue
		}
		if !end.IsZero() && r.Bucket.After(end) {
			continue
		}
		results = append(results, r)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Bucket.Before(results[j].Bucket)
	})

	return results, nil
}

// DropEventsOlderThan drops all raw events older than cutoff.
func (m *InMemoryTimeSeriesStore) DropEventsOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	var kept []domain.RequestEvent
	var dropped int64
	for _, e := range m.events {
		if e.Timestamp.Before(cutoff) {
			dropped++
		} else {
			kept = append(kept, e)
		}
	}
	m.events = kept
	return dropped, nil
}
