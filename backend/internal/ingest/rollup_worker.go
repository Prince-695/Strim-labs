package ingest

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
	"github.com/google/uuid"
)

// AggregateRawEventsTo1m aggregates a slice of raw events into 1-minute bucket rollups.
func AggregateRawEventsTo1m(events []domain.RequestEvent) []domain.RequestRollup1m {
	if len(events) == 0 {
		return nil
	}

	type groupKey struct {
		projectID   string
		endpointKey string
		bucket      time.Time
	}

	type accum struct {
		count        int64
		errors       int64
		sumMs        float64
		minMs        float64
		maxMs        float64
		hist         *histogram.Histogram
		statusCounts map[string]int64
	}

	groups := make(map[groupKey]*accum)

	for _, e := range events {
		bucket := e.Timestamp.UTC().Truncate(time.Minute)
		route := e.Route
		if route == "" {
			route = "UNKNOWN"
		}
		endpointKey := fmt.Sprintf("%s %s", e.Method, route)

		k := groupKey{
			projectID:   e.ProjectID,
			endpointKey: endpointKey,
			bucket:      bucket,
		}

		acc, exists := groups[k]
		if !exists {
			acc = &accum{
				minMs:        math.MaxFloat64,
				maxMs:        0,
				hist:         histogram.NewHistogram(),
				statusCounts: make(map[string]int64),
			}
			groups[k] = acc
		}

		acc.count++
		if e.IsError || e.Status >= 400 || e.Status == 0 {
			acc.errors++
		}
		acc.sumMs += e.DurationMs
		if e.DurationMs < acc.minMs {
			acc.minMs = e.DurationMs
		}
		if e.DurationMs > acc.maxMs {
			acc.maxMs = e.DurationMs
		}
		acc.hist.Add(e.DurationMs)

		statusStr := strconv.Itoa(e.Status)
		acc.statusCounts[statusStr]++
	}

	rollups := make([]domain.RequestRollup1m, 0, len(groups))
	for k, acc := range groups {
		if acc.minMs == math.MaxFloat64 {
			acc.minMs = 0
		}

		// Convert statusCounts to JSONMap
		statusMap := make(domain.JSONMap, len(acc.statusCounts))
		for statusKey, count := range acc.statusCounts {
			statusMap[statusKey] = count
		}

		rollups = append(rollups, domain.RequestRollup1m{
			ID:           uuid.NewString(),
			ProjectID:    k.projectID,
			EndpointKey:  k.endpointKey,
			Bucket:       k.bucket,
			Count:        acc.count,
			Errors:       acc.errors,
			SumMs:        acc.sumMs,
			MinMs:        acc.minMs,
			MaxMs:        acc.maxMs,
			Histogram:    acc.hist.ToBytes(),
			StatusCounts: statusMap,
		})
	}

	return rollups
}

// Aggregate1mTo1h aggregates 1-minute rollups into 1-hour rollups.
func Aggregate1mTo1h(rollups1m []domain.RequestRollup1m) []domain.RequestRollup1h {
	if len(rollups1m) == 0 {
		return nil
	}

	type groupKey struct {
		projectID   string
		endpointKey string
		bucket      time.Time
	}

	type accum struct {
		count        int64
		errors       int64
		sumMs        float64
		minMs        float64
		maxMs        float64
		hist         *histogram.Histogram
		statusCounts map[string]int64
	}

	groups := make(map[groupKey]*accum)

	for _, r := range rollups1m {
		hourBucket := r.Bucket.UTC().Truncate(time.Hour)
		k := groupKey{
			projectID:   r.ProjectID,
			endpointKey: r.EndpointKey,
			bucket:      hourBucket,
		}

		acc, exists := groups[k]
		if !exists {
			acc = &accum{
				minMs:        math.MaxFloat64,
				maxMs:        0,
				hist:         histogram.NewHistogram(),
				statusCounts: make(map[string]int64),
			}
			groups[k] = acc
		}

		acc.count += r.Count
		acc.errors += r.Errors
		acc.sumMs += r.SumMs
		if r.MinMs < acc.minMs {
			acc.minMs = r.MinMs
		}
		if r.MaxMs > acc.maxMs {
			acc.maxMs = r.MaxMs
		}

		// Merge histogram
		if subHist, err := histogram.FromBytes(r.Histogram); err == nil {
			acc.hist.Merge(subHist)
		}

		// Merge status counts
		for statusKey, countVal := range r.StatusCounts {
			switch c := countVal.(type) {
			case int64:
				acc.statusCounts[statusKey] += c
			case float64:
				acc.statusCounts[statusKey] += int64(c)
			case int:
				acc.statusCounts[statusKey] += int64(c)
			}
		}
	}

	rollups1h := make([]domain.RequestRollup1h, 0, len(groups))
	for k, acc := range groups {
		if acc.minMs == math.MaxFloat64 {
			acc.minMs = 0
		}

		statusMap := make(domain.JSONMap, len(acc.statusCounts))
		for statusKey, count := range acc.statusCounts {
			statusMap[statusKey] = count
		}

		rollups1h = append(rollups1h, domain.RequestRollup1h{
			ID:           uuid.NewString(),
			ProjectID:    k.projectID,
			EndpointKey:  k.endpointKey,
			Bucket:       k.bucket,
			Count:        acc.count,
			Errors:       acc.errors,
			SumMs:        acc.sumMs,
			MinMs:        acc.minMs,
			MaxMs:        acc.maxMs,
			Histogram:    acc.hist.ToBytes(),
			StatusCounts: statusMap,
		})
	}

	return rollups1h
}

// RollupWorker provides automated periodic time-series aggregation from raw events to 1m and 1h tables.
type RollupWorker struct {
	store  TimeSeriesStore
	logger *slog.Logger
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewRollupWorker initializes a new RollupWorker.
func NewRollupWorker(store TimeSeriesStore, logger *slog.Logger) *RollupWorker {
	if logger == nil {
		logger = slog.Default()
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &RollupWorker{
		store:  store,
		logger: logger,
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start runs background ticker-based rollups.
func (w *RollupWorker) Start() {
	w.wg.Add(1)
	go w.run()
}

// run schedules 1m aggregations every minute and 1h aggregations periodically.
func (w *RollupWorker) run() {
	defer w.wg.Done()

	ticker1m := time.NewTicker(1 * time.Minute)
	defer ticker1m.Stop()

	ticker1h := time.NewTicker(15 * time.Minute)
	defer ticker1h.Stop()

	for {
		select {
		case <-w.ctx.Done():
			return

		case <-ticker1m.C:
			// Process previous full minute
			prevMinute := time.Now().UTC().Truncate(time.Minute).Add(-1 * time.Minute)
			if err := w.ProcessMinute(w.ctx, prevMinute); err != nil {
				w.logger.Error("RollupWorker 1m aggregation failed", "bucket", prevMinute, "error", err)
			}

		case <-ticker1h.C:
			// Process previous full hour
			prevHour := time.Now().UTC().Truncate(time.Hour).Add(-1 * time.Hour)
			if err := w.ProcessHour(w.ctx, prevHour); err != nil {
				w.logger.Error("RollupWorker 1h aggregation failed", "bucket", prevHour, "error", err)
			}
		}
	}
}

// ProcessMinute aggregates raw events in [bucket, bucket+1m) into request_rollup_1m.
func (w *RollupWorker) ProcessMinute(ctx context.Context, bucket time.Time) error {
	start := bucket.UTC().Truncate(time.Minute)
	end := start.Add(1 * time.Minute)

	// Fetch raw events in time window across all projects
	// In GORM, QueryEvents accepts projectID; when blank, GormTimeSeriesStore returns all
	events, err := w.store.QueryEvents(ctx, "", start, end, 10000)
	if err != nil {
		return err
	}

	if len(events) == 0 {
		return nil
	}

	rollups1m := AggregateRawEventsTo1m(events)
	return w.store.WriteRollups1m(ctx, rollups1m)
}

// ProcessHour aggregates 1-minute rollups in [hourBucket, hourBucket+1h) into request_rollup_1h.
func (w *RollupWorker) ProcessHour(ctx context.Context, hourBucket time.Time) error {
	start := hourBucket.UTC().Truncate(time.Hour)
	end := start.Add(1 * time.Hour)

	rollups1m, err := w.store.QueryRollups1m(ctx, "", "", start, end)
	if err != nil {
		return err
	}

	if len(rollups1m) == 0 {
		return nil
	}

	rollups1h := Aggregate1mTo1h(rollups1m)
	return w.store.WriteRollups1h(ctx, rollups1h)
}

// Stop terminates the rollup worker gracefully.
func (w *RollupWorker) Stop() {
	w.cancel()
	w.wg.Wait()
}
