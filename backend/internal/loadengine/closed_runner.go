package loadengine

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// ClosedRunner executes a closed-model load test where N virtual users continuously
// send requests and wait for responses with optional think time.
type ClosedRunner struct {
	dispatcher Dispatcher
	aggregator *Aggregator
}

// NewClosedRunner instantiates a closed model runner.
func NewClosedRunner(dispatcher Dispatcher, aggregator *Aggregator) *ClosedRunner {
	return &ClosedRunner{
		dispatcher: dispatcher,
		aggregator: aggregator,
	}
}

// Run executes the virtual user loop, emitting 1-second progress ticks.
func (r *ClosedRunner) Run(
	ctx context.Context,
	cfg domain.LoadTestConfig,
	onTick func(ts *domain.LoadTestTimeseries, tick domain.SSEProgressTickData),
) error {
	vus := cfg.MaxVirtualUsers
	if vus <= 0 {
		vus = 10
	}
	if vus > 500 {
		vus = 500
	}

	timeout := time.Duration(cfg.TimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	thinkTime := time.Duration(cfg.ThinkTimeMS) * time.Millisecond

	testCtx, cancel := context.WithTimeout(ctx, time.Duration(cfg.DurationSeconds)*time.Second)
	defer cancel()

	var wg sync.WaitGroup

	// Background ticker for 1-second progress ticks
	tickerDone := make(chan struct{})
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()
		second := 0

		for {
			select {
			case <-testCtx.Done():
				close(tickerDone)
				return
			case <-ticker.C:
				ts, tick := r.aggregator.Tick(second)
				if onTick != nil {
					onTick(ts, tick)
				}
				second++
			}
		}
	}()

	// Spawn Virtual Users
	for i := 0; i < vus; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-testCtx.Done():
					return
				default:
				}

				target := r.dispatcher.SelectTarget()
				tStart := time.Now()
				r.aggregator.IncActive()

				code, bytes, err := r.dispatcher.Dispatch(testCtx, target, timeout)
				r.aggregator.DecActive()
				tDone := time.Now()

				latencyMs := float64(tDone.Sub(tStart).Microseconds()) / 1000.0
				if latencyMs < 0 {
					latencyMs = 0
				}
				isTimeout := errors.Is(err, context.DeadlineExceeded)

				r.aggregator.Record(target, code, latencyMs, bytes, isTimeout)

				if thinkTime > 0 {
					select {
					case <-time.After(thinkTime):
					case <-testCtx.Done():
						return
					}
				}
			}
		}()
	}

	// Wait for duration completion or parent context cancellation
	<-testCtx.Done()
	<-tickerDone

	// Graceful drain with bounded 2-second timeout
	drainCtx, drainCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer drainCancel()

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-drainCtx.Done():
	}

	return nil
}
