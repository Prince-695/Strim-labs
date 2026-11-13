package ingest

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRegistrar struct {
	mu     sync.Mutex
	routes []discovery.DiscoveredRoute
}

func (m *mockRegistrar) UpsertRoute(ctx context.Context, projectID string, route discovery.DiscoveredRoute, source domain.DiscoverySource, metadata domain.JSONMap) (*domain.APIEndpoint, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.routes = append(m.routes, route)
	return &domain.APIEndpoint{
		ID:           "ep-1",
		ProjectID:    projectID,
		Method:       route.Method,
		PathTemplate: route.PathTemplate,
	}, true, nil
}

func TestBatcher_Backpressure(t *testing.T) {
	store := NewInMemoryTimeSeriesStore()
	cfg := BatcherConfig{
		Capacity:              10,
		BatchSize:             5,
		FlushInterval:         10 * time.Second, // Long ticker so we control flushes
		BackpressureThreshold: 0.8,              // 80% threshold = 8 items
	}
	batcher := NewBatcher(cfg, store, nil, nil)
	// Do not start worker loop yet, so channel fills up

	for i := 0; i < 8; i++ {
		err := batcher.Enqueue(domain.RequestEvent{
			ProjectID:  "proj-1",
			Method:     "GET",
			Route:      "/test",
			DurationMs: 10,
		})
		require.NoError(t, err, "Item %d should succeed", i)
	}

	// 9th item should hit backpressure threshold (8 / 10 = 0.80 >= 0.8)
	err := batcher.Enqueue(domain.RequestEvent{
		ProjectID:  "proj-1",
		Method:     "GET",
		Route:      "/test",
		DurationMs: 10,
	})
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeIngestBackpressure, appErr.ErrorCode)
}

func TestBatcher_FlushOnBatchSize(t *testing.T) {
	store := NewInMemoryTimeSeriesStore()
	registrar := &mockRegistrar{}
	cfg := BatcherConfig{
		Capacity:      100,
		BatchSize:     5,
		FlushInterval: 10 * time.Second,
	}
	batcher := NewBatcher(cfg, store, registrar, nil)
	batcher.Start()
	defer batcher.Stop()

	for i := 0; i < 5; i++ {
		err := batcher.Enqueue(domain.RequestEvent{
			ProjectID:  "proj-1",
			Timestamp:  time.Now(),
			Method:     "POST",
			Route:      "/items",
			DurationMs: 15,
		})
		require.NoError(t, err)
	}

	// Wait briefly for batch flush
	assert.Eventually(t, func() bool {
		events, _ := store.QueryEvents(context.Background(), "proj-1", time.Time{}, time.Time{}, 10)
		return len(events) == 5
	}, 2*time.Second, 20*time.Millisecond)

	// Verify runtime endpoint discovery was triggered
	registrar.mu.Lock()
	defer registrar.mu.Unlock()
	assert.NotEmpty(t, registrar.routes)
	assert.Equal(t, "POST", registrar.routes[0].Method)
	assert.Equal(t, "/items", registrar.routes[0].PathTemplate)
}

func TestBatcher_FlushOnTicker(t *testing.T) {
	store := NewInMemoryTimeSeriesStore()
	cfg := BatcherConfig{
		Capacity:      100,
		BatchSize:     50, // Higher than items enqueued
		FlushInterval: 50 * time.Millisecond,
	}
	batcher := NewBatcher(cfg, store, nil, nil)
	batcher.Start()
	defer batcher.Stop()

	err := batcher.Enqueue(domain.RequestEvent{
		ProjectID:  "proj-ticker",
		Timestamp:  time.Now(),
		Method:     "GET",
		Route:      "/ticker-test",
		DurationMs: 22,
	})
	require.NoError(t, err)

	assert.Eventually(t, func() bool {
		events, _ := store.QueryEvents(context.Background(), "proj-ticker", time.Time{}, time.Time{}, 10)
		return len(events) == 1
	}, 2*time.Second, 20*time.Millisecond)
}

func TestBatcher_GracefulDrainOnStop(t *testing.T) {
	store := NewInMemoryTimeSeriesStore()
	cfg := BatcherConfig{
		Capacity:      100,
		BatchSize:     50,
		FlushInterval: 10 * time.Second,
	}
	batcher := NewBatcher(cfg, store, nil, nil)
	batcher.Start()

	for i := 0; i < 7; i++ {
		_ = batcher.Enqueue(domain.RequestEvent{
			ProjectID:  "proj-drain",
			Timestamp:  time.Now(),
			Method:     "GET",
			Route:      "/drain",
			DurationMs: 10,
		})
	}

	// Stop batcher immediately; all 7 items should be flushed during drain
	batcher.Stop()

	events, err := store.QueryEvents(context.Background(), "proj-drain", time.Time{}, time.Time{}, 20)
	require.NoError(t, err)
	assert.Equal(t, 7, len(events))
}
