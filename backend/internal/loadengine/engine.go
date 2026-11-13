package loadengine

import (
	"context"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
)

// Engine defines the high-level contract for executing load tests.
type Engine interface {
	Run(
		ctx context.Context,
		testID string,
		baseURL string,
		cfg domain.LoadTestConfig,
		onTick func(ts *domain.LoadTestTimeseries, tick domain.SSEProgressTickData),
	) (domain.LoadTestResultsResponse, *histogram.Histogram, error)
}

type defaultEngine struct{}

// NewEngine instantiates a standard load testing engine.
func NewEngine() Engine {
	return &defaultEngine{}
}

// Run configures dispatcher, aggregator, selects open vs closed runner, and executes the test.
func (e *defaultEngine) Run(
	ctx context.Context,
	testID string,
	baseURL string,
	cfg domain.LoadTestConfig,
	onTick func(ts *domain.LoadTestTimeseries, tick domain.SSEProgressTickData),
) (domain.LoadTestResultsResponse, *histogram.Histogram, error) {
	dispatcher := NewHTTPDispatcher(baseURL, cfg.Targets, nil)
	aggregator := NewAggregator(testID)

	var runErr error
	if cfg.Model == domain.ModelClosed {
		runner := NewClosedRunner(dispatcher, aggregator)
		runErr = runner.Run(ctx, cfg, onTick)
	} else {
		runner := NewOpenRunner(dispatcher, aggregator)
		runErr = runner.Run(ctx, cfg, onTick)
	}

	results, hist := aggregator.Finish(cfg.DurationSeconds)
	return results, hist, runErr
}
