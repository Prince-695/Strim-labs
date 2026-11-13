package loadengine

import (
	"context"
	"errors"
	"math"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// OpenRunner executes an open-model load test where requests are scheduled according
// to the target arrival rate independent of server latency (eliminating coordinated omission).
type OpenRunner struct {
	dispatcher Dispatcher
	aggregator *Aggregator
}

// NewOpenRunner instantiates an open model runner.
func NewOpenRunner(dispatcher Dispatcher, aggregator *Aggregator) *OpenRunner {
	return &OpenRunner{
		dispatcher: dispatcher,
		aggregator: aggregator,
	}
}

// Run executes the scheduled test across durationSeconds, emitting 1-second progress ticks.
func (r *OpenRunner) Run(
	ctx context.Context,
	cfg domain.LoadTestConfig,
	onTick func(ts *domain.LoadTestTimeseries, tick domain.SSEProgressTickData),
) error {
	maxConcurrency := cfg.MaxVirtualUsers
	if maxConcurrency <= 0 {
		maxConcurrency = 200
	}
	if maxConcurrency > 500 {
		maxConcurrency = 500
	}

	sem := make(chan struct{}, maxConcurrency)
	var inFlightWg sync.WaitGroup
	timeout := time.Duration(cfg.TimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	for second := 0; second < cfg.DurationSeconds; second++ {
		if ctx.Err() != nil {
			break
		}

		rate := CalculateTargetRate(cfg.Profile, cfg, second)
		r.aggregator.SetOfferedRPS(rate)

		numRequests := int(math.Round(rate))
		secondStart := time.Now()
		var interval time.Duration
		if numRequests > 0 {
			interval = time.Duration(float64(time.Second) / float64(numRequests))
		}

		for i := 0; i < numRequests; i++ {
			if ctx.Err() != nil {
				break
			}

			intendedSendTime := secondStart.Add(time.Duration(i) * interval)
			now := time.Now()
			if intendedSendTime.After(now) {
				time.Sleep(intendedSendTime.Sub(now))
			}

			actualSendTime := time.Now()
			lagMs := actualSendTime.Sub(intendedSendTime).Milliseconds()
			r.aggregator.RecordLag(lagMs)

			target := r.dispatcher.SelectTarget()

			select {
			case sem <- struct{}{}:
				inFlightWg.Add(1)
				r.aggregator.IncActive()

				go func(tgt domain.LoadTestTarget, tIntended time.Time) {
					defer func() {
						<-sem
						r.aggregator.DecActive()
						inFlightWg.Done()
					}()

					code, bytes, err := r.dispatcher.Dispatch(ctx, tgt, timeout)
					tDone := time.Now()
					// Latency measured from INTENDED send time to eliminate coordinated omission
					latencyMs := float64(tDone.Sub(tIntended).Microseconds()) / 1000.0
					if latencyMs < 0 {
						latencyMs = 0
					}
					isTimeout := errors.Is(err, context.DeadlineExceeded)

					r.aggregator.Record(tgt, code, latencyMs, bytes, isTimeout)
				}(target, intendedSendTime)

			case <-ctx.Done():
				break
			}
		}

		// Wait until the 1-second boundary has completed before emitting tick
		remaining := time.Until(secondStart.Add(time.Second))
		if remaining > 0 {
			time.Sleep(remaining)
		}

		ts, tick := r.aggregator.Tick(second)
		if onTick != nil {
			onTick(ts, tick)
		}
	}

	// Graceful drain with bounded 2-second timeout
	drainCtx, drainCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer drainCancel()

	done := make(chan struct{})
	go func() {
		inFlightWg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-drainCtx.Done():
	}

	return nil
}
