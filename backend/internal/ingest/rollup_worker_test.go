package ingest

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAggregateRawEventsTo1m(t *testing.T) {
	bucket := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)

	events := []domain.RequestEvent{
		{
			ProjectID:  "proj-a",
			Timestamp:  bucket.Add(10 * time.Second),
			Method:     "GET",
			Route:      "/users/{id}",
			Status:     200,
			DurationMs: 20.0,
		},
		{
			ProjectID:  "proj-a",
			Timestamp:  bucket.Add(25 * time.Second),
			Method:     "GET",
			Route:      "/users/{id}",
			Status:     200,
			DurationMs: 40.0,
		},
		{
			ProjectID:  "proj-a",
			Timestamp:  bucket.Add(45 * time.Second),
			Method:     "GET",
			Route:      "/users/{id}",
			Status:     500,
			DurationMs: 120.0,
			IsError:    true,
		},
		{
			ProjectID:  "proj-a",
			Timestamp:  bucket.Add(15 * time.Second),
			Method:     "POST",
			Route:      "/orders",
			Status:     201,
			DurationMs: 80.0,
		},
	}

	rollups := AggregateRawEventsTo1m(events)
	require.Equal(t, 2, len(rollups))

	var usersRollup *domain.RequestRollup1m
	for i := range rollups {
		if rollups[i].EndpointKey == "GET /users/{id}" {
			usersRollup = &rollups[i]
		}
	}

	require.NotNil(t, usersRollup)
	assert.Equal(t, "proj-a", usersRollup.ProjectID)
	assert.Equal(t, bucket, usersRollup.Bucket)
	assert.Equal(t, int64(3), usersRollup.Count)
	assert.Equal(t, int64(1), usersRollup.Errors)
	assert.InDelta(t, 180.0, usersRollup.SumMs, 1e-4)
	assert.Equal(t, 20.0, usersRollup.MinMs)
	assert.Equal(t, 120.0, usersRollup.MaxMs)

	// Verify deserialized histogram percentiles
	hist, err := histogram.FromBytes(usersRollup.Histogram)
	require.NoError(t, err)
	assert.Equal(t, uint64(3), hist.Count)
	assert.InDelta(t, 40.0, hist.Quantile(0.50), 10.0) // median ~40ms
}

func TestAggregate1mTo1h(t *testing.T) {
	hourBucket := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)

	// Create 2 1m rollups for the same endpoint in the same hour
	h1 := histogram.NewHistogram()
	h1.Add(10.0)
	h1.Add(20.0)

	h2 := histogram.NewHistogram()
	h2.Add(30.0)
	h2.Add(40.0)

	rollups1m := []domain.RequestRollup1m{
		{
			ID:           "r1",
			ProjectID:    "proj-b",
			EndpointKey:  "GET /items",
			Bucket:       hourBucket.Add(5 * time.Minute),
			Count:        2,
			Errors:       0,
			SumMs:        30.0,
			MinMs:        10.0,
			MaxMs:        20.0,
			Histogram:    h1.ToBytes(),
			StatusCounts: domain.JSONMap{"200": int64(2)},
		},
		{
			ID:           "r2",
			ProjectID:    "proj-b",
			EndpointKey:  "GET /items",
			Bucket:       hourBucket.Add(25 * time.Minute),
			Count:        2,
			Errors:       1,
			SumMs:        70.0,
			MinMs:        30.0,
			MaxMs:        40.0,
			Histogram:    h2.ToBytes(),
			StatusCounts: domain.JSONMap{"200": int64(1), "500": int64(1)},
		},
	}

	rollups1h := Aggregate1mTo1h(rollups1m)
	require.Equal(t, 1, len(rollups1h))

	r1h := rollups1h[0]
	assert.Equal(t, "proj-b", r1h.ProjectID)
	assert.Equal(t, "GET /items", r1h.EndpointKey)
	assert.Equal(t, hourBucket, r1h.Bucket)
	assert.Equal(t, int64(4), r1h.Count)
	assert.Equal(t, int64(1), r1h.Errors)
	assert.InDelta(t, 100.0, r1h.SumMs, 1e-4)
	assert.Equal(t, 10.0, r1h.MinMs)
	assert.Equal(t, 40.0, r1h.MaxMs)

	// Merged histogram verification
	mergedHist, err := histogram.FromBytes(r1h.Histogram)
	require.NoError(t, err)
	assert.Equal(t, uint64(4), mergedHist.Count)
	assert.InDelta(t, 100.0, mergedHist.Sum, 1e-4)

	// Status counts merged
	assert.Equal(t, int64(3), r1h.StatusCounts["200"])
	assert.Equal(t, int64(1), r1h.StatusCounts["500"])
}

func TestRollupWorker_ProcessMinuteAndHour(t *testing.T) {
	ctx := context.Background()
	store := NewInMemoryTimeSeriesStore()
	worker := NewRollupWorker(store, nil)

	bucket := time.Date(2026, 11, 11, 14, 30, 0, 0, time.UTC)
	events := []domain.RequestEvent{
		{
			ProjectID:  "proj-worker",
			Timestamp:  bucket.Add(5 * time.Second),
			Method:     "GET",
			Route:      "/ping",
			Status:     200,
			DurationMs: 4.5,
		},
		{
			ProjectID:  "proj-worker",
			Timestamp:  bucket.Add(35 * time.Second),
			Method:     "GET",
			Route:      "/ping",
			Status:     200,
			DurationMs: 5.5,
		},
	}

	err := store.WriteEvents(ctx, events)
	require.NoError(t, err)

	// Run ProcessMinute
	err = worker.ProcessMinute(ctx, bucket)
	require.NoError(t, err)

	rollups1m, err := store.QueryRollups1m(ctx, "proj-worker", "GET /ping", bucket, bucket.Add(1*time.Minute))
	require.NoError(t, err)
	require.Equal(t, 1, len(rollups1m))
	assert.Equal(t, int64(2), rollups1m[0].Count)

	// Run ProcessHour
	hourBucket := bucket.Truncate(time.Hour)
	err = worker.ProcessHour(ctx, hourBucket)
	require.NoError(t, err)

	rollups1h, err := store.QueryRollups1h(ctx, "proj-worker", "GET /ping", hourBucket, hourBucket.Add(1*time.Hour))
	require.NoError(t, err)
	require.Equal(t, 1, len(rollups1h))
	assert.Equal(t, int64(2), rollups1h[0].Count)
}
