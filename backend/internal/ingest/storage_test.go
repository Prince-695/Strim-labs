package ingest

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestInMemoryTimeSeriesStore(t *testing.T) {
	ctx := context.Background()
	store := NewInMemoryTimeSeriesStore()

	now := time.Now().UTC().Truncate(time.Second)
	events := []domain.RequestEvent{
		{
			ProjectID:  "proj-1",
			Timestamp:  now.Add(-2 * time.Minute),
			Method:     "GET",
			Route:      "/users",
			Status:     200,
			DurationMs: 25.5,
		},
		{
			ProjectID:  "proj-1",
			Timestamp:  now.Add(-1 * time.Minute),
			Method:     "POST",
			Route:      "/users",
			Status:     201,
			DurationMs: 45.0,
		},
		{
			ProjectID:  "proj-2",
			Timestamp:  now,
			Method:     "GET",
			Route:      "/orders",
			Status:     500,
			DurationMs: 120.0,
			IsError:    true,
		},
	}

	err := store.WriteEvents(ctx, events)
	require.NoError(t, err)

	// Query proj-1 events
	res, err := store.QueryEvents(ctx, "proj-1", now.Add(-5*time.Minute), now, 10)
	require.NoError(t, err)
	assert.Equal(t, 2, len(res))
	assert.Equal(t, "POST", res[0].Method) // descending order

	// Query proj-2
	res2, err := store.QueryEvents(ctx, "proj-2", time.Time{}, time.Time{}, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, len(res2))

	// Test DropEventsOlderThan
	dropped, err := store.DropEventsOlderThan(ctx, now.Add(-90*time.Second))
	require.NoError(t, err)
	assert.Equal(t, int64(1), dropped)

	resAfterDrop, err := store.QueryEvents(ctx, "proj-1", time.Time{}, time.Time{}, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, len(resAfterDrop))
}

func TestGormTimeSeriesStore_SQLite(t *testing.T) {
	ctx := context.Background()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)

	err = db.AutoMigrate(&domain.RequestEvent{}, &domain.RequestRollup1m{}, &domain.RequestRollup1h{})
	require.NoError(t, err)

	store := NewGormTimeSeriesStore(db)

	now := time.Now().UTC().Truncate(time.Minute)
	events := []domain.RequestEvent{
		{
			ProjectID:  "proj-test-1",
			Timestamp:  now.Add(-30 * time.Second),
			Method:     "GET",
			Route:      "/health",
			Status:     200,
			DurationMs: 5.2,
		},
		{
			ProjectID:  "proj-test-1",
			Timestamp:  now.Add(-10 * time.Second),
			Method:     "GET",
			Route:      "/health",
			Status:     200,
			DurationMs: 6.1,
		},
	}

	err = store.WriteEvents(ctx, events)
	require.NoError(t, err)

	queried, err := store.QueryEvents(ctx, "proj-test-1", now.Add(-1*time.Minute), now, 10)
	require.NoError(t, err)
	assert.Equal(t, 2, len(queried))

	// Test Rollup 1m
	rollups1m := []domain.RequestRollup1m{
		{
			ID:          "roll-1",
			ProjectID:   "proj-test-1",
			EndpointKey: "GET /health",
			Bucket:      now,
			Count:       2,
			SumMs:       11.3,
			MinMs:       5.2,
			MaxMs:       6.1,
			Histogram:   []byte("test-hist"),
		},
	}

	err = store.WriteRollups1m(ctx, rollups1m)
	require.NoError(t, err)

	qRollups, err := store.QueryRollups1m(ctx, "proj-test-1", "GET /health", now.Add(-1*time.Minute), now.Add(1*time.Minute))
	require.NoError(t, err)
	assert.Equal(t, 1, len(qRollups))
	assert.Equal(t, int64(2), qRollups[0].Count)

	// Test Drop
	dropped, err := store.DropEventsOlderThan(ctx, now)
	require.NoError(t, err)
	assert.Equal(t, int64(2), dropped)
}
