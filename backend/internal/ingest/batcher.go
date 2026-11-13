package ingest

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
)

const (
	DefaultBufferCapacity        = 10000
	DefaultBatchSize             = 500
	DefaultFlushInterval         = 1 * time.Second
	DefaultBackpressureThreshold = 0.95 // 95% full
)

// EndpointRegistrar defines the runtime discovery route registration contract.
type EndpointRegistrar interface {
	UpsertRoute(ctx context.Context, projectID string, route discovery.DiscoveredRoute, source domain.DiscoverySource, metadata domain.JSONMap) (*domain.APIEndpoint, bool, error)
}

// BatcherConfig defines options for the Ingestion Batcher.
type BatcherConfig struct {
	Capacity              int
	BatchSize             int
	FlushInterval         time.Duration
	BackpressureThreshold float64
}

// Batcher orchestrates bounded channel buffering, backpressure, batch flushes, and runtime route discovery.
type Batcher struct {
	cfg       BatcherConfig
	events    chan domain.RequestEvent
	store     TimeSeriesStore
	registrar EndpointRegistrar
	logger    *slog.Logger
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	closed    atomic.Bool

	// seenRoutes tracks recently registered (projectID, method, route) to minimize DB queries
	seenMu     sync.RWMutex
	seenRoutes map[string]time.Time
}

// NewBatcher initializes a new high-throughput telemetry batcher.
func NewBatcher(cfg BatcherConfig, store TimeSeriesStore, registrar EndpointRegistrar, logger *slog.Logger) *Batcher {
	if cfg.Capacity <= 0 {
		cfg.Capacity = DefaultBufferCapacity
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = DefaultBatchSize
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = DefaultFlushInterval
	}
	if cfg.BackpressureThreshold <= 0 || cfg.BackpressureThreshold > 1.0 {
		cfg.BackpressureThreshold = DefaultBackpressureThreshold
	}
	if logger == nil {
		logger = slog.Default()
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &Batcher{
		cfg:        cfg,
		events:     make(chan domain.RequestEvent, cfg.Capacity),
		store:      store,
		registrar:  registrar,
		logger:     logger,
		ctx:        ctx,
		cancel:     cancel,
		seenRoutes: make(map[string]time.Time),
	}
}

// Start launches the background worker loop.
func (b *Batcher) Start() {
	b.wg.Add(1)
	go b.worker()
}

// Enqueue puts a single telemetry event into the buffer; returns backpressure error if near capacity.
func (b *Batcher) Enqueue(event domain.RequestEvent) error {
	if b.closed.Load() {
		return domain.NewServiceUnavailableError("telemetry batcher is shutting down", nil)
	}

	// Backpressure check: if occupancy ratio exceeds configured threshold (default 95%)
	currentLen := len(b.events)
	if float64(currentLen)/float64(b.cfg.Capacity) >= b.cfg.BackpressureThreshold {
		return domain.NewIngestBackpressureError(2)
	}

	select {
	case b.events <- event:
		return nil
	default:
		return domain.NewIngestBackpressureError(2)
	}
}

// EnqueueBatch enqueues multiple events, stopping if backpressure is reached.
func (b *Batcher) EnqueueBatch(events []domain.RequestEvent) (int, error) {
	accepted := 0
	for _, event := range events {
		if err := b.Enqueue(event); err != nil {
			return accepted, err
		}
		accepted++
	}
	return accepted, nil
}

// QueueDepth returns the current number of buffered events.
func (b *Batcher) QueueDepth() int {
	return len(b.events)
}

// Capacity returns the maximum buffer capacity.
func (b *Batcher) Capacity() int {
	return b.cfg.Capacity
}

// worker coordinates batch collection, ticker flushes, and graceful shutdown.
func (b *Batcher) worker() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.cfg.FlushInterval)
	defer ticker.Stop()

	batch := make([]domain.RequestEvent, 0, b.cfg.BatchSize)

	for {
		select {
		case <-b.ctx.Done():
			// Flush any remaining accumulated events
			if len(batch) > 0 {
				b.flush(batch)
			}
			// Drain remaining events in channel
			b.drain()
			return

		case event, ok := <-b.events:
			if !ok {
				if len(batch) > 0 {
					b.flush(batch)
				}
				return
			}
			batch = append(batch, event)
			if len(batch) >= b.cfg.BatchSize {
				b.flush(batch)
				batch = make([]domain.RequestEvent, 0, b.cfg.BatchSize)
			}

		case <-ticker.C:
			if len(batch) > 0 {
				b.flush(batch)
				batch = make([]domain.RequestEvent, 0, b.cfg.BatchSize)
			}
			b.cleanSeenRoutes()
		}
	}
}

// flush persists events and triggers runtime endpoint discovery.
func (b *Batcher) flush(batch []domain.RequestEvent) {
	if len(batch) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := b.store.WriteEvents(ctx, batch); err != nil {
		b.logger.Error("Failed to persist raw telemetry events batch", "count", len(batch), "error", err)
	}

	// Trigger runtime endpoint discovery
	b.discoverRuntimeEndpoints(ctx, batch)
}

// discoverRuntimeEndpoints extracts new (projectID, method, route) pairs and upserts them.
func (b *Batcher) discoverRuntimeEndpoints(ctx context.Context, batch []domain.RequestEvent) {
	if b.registrar == nil {
		return
	}

	type routeKey struct {
		projectID string
		method    string
		route     string
	}

	uniqueRoutes := make(map[routeKey]struct{})
	for _, e := range batch {
		if e.Route == "" || e.ProjectID == "" {
			continue
		}
		uniqueRoutes[routeKey{projectID: e.ProjectID, method: e.Method, route: e.Route}] = struct{}{}
	}

	for rk := range uniqueRoutes {
		cacheKey := fmt.Sprintf("%s:%s:%s", rk.projectID, rk.method, rk.route)

		b.seenMu.RLock()
		lastSeen, found := b.seenRoutes[cacheKey]
		b.seenMu.RUnlock()

		// Skip if seen in the last 10 minutes
		if found && time.Since(lastSeen) < 10*time.Minute {
			continue
		}

		route := discovery.DiscoveredRoute{
			Method:       rk.method,
			PathTemplate: rk.route,
		}

		if _, _, err := b.registrar.UpsertRoute(ctx, rk.projectID, route, domain.SourceRuntime, nil); err != nil {
			b.logger.Debug("Failed to register runtime route", "route", rk.route, "method", rk.method, "error", err)
		} else {
			b.seenMu.Lock()
			b.seenRoutes[cacheKey] = time.Now()
			b.seenMu.Unlock()
		}
	}
}

// cleanSeenRoutes prunes cached seen routes older than 1 hour.
func (b *Batcher) cleanSeenRoutes() {
	b.seenMu.Lock()
	defer b.seenMu.Unlock()

	cutoff := time.Now().Add(-1 * time.Hour)
	for k, t := range b.seenRoutes {
		if t.Before(cutoff) {
			delete(b.seenRoutes, k)
		}
	}
}

// drain processes all remaining events left in channel after stop.
func (b *Batcher) drain() {
	batch := make([]domain.RequestEvent, 0, b.cfg.BatchSize)
	for {
		select {
		case event, ok := <-b.events:
			if !ok {
				if len(batch) > 0 {
					b.flush(batch)
				}
				return
			}
			batch = append(batch, event)
			if len(batch) >= b.cfg.BatchSize {
				b.flush(batch)
				batch = batch[:0]
			}
		default:
			if len(batch) > 0 {
				b.flush(batch)
			}
			return
		}
	}
}

// Stop gracefully shuts down the batcher, draining and flushing remaining events.
func (b *Batcher) Stop() {
	if b.closed.Swap(true) {
		return
	}
	b.cancel()
	b.wg.Wait()
}
