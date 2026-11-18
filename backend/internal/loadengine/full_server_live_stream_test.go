package loadengine_test

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/loadengine"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAggregator_LiveLogs_And_EndpointHealth(t *testing.T) {
	agg := loadengine.NewAggregator("test-stream-001")

	target1 := domain.LoadTestTarget{Method: "GET", Path: "/api/v1/feed", Weight: 10}
	target2 := domain.LoadTestTarget{Method: "POST", Path: "/api/v1/checkout", Weight: 2}

	// 1. Simulate 20 successful requests to feed
	for i := 0; i < 20; i++ {
		agg.Record(target1, 200, 15.5, 1024, false)
	}

	// 2. Simulate 5 failing requests to checkout (504 timeout and 429 rate limit)
	agg.Record(target2, 504, 1500.0, 512, true, "gateway_timeout")
	agg.Record(target2, 504, 1600.0, 512, true, "gateway_timeout")
	agg.Record(target2, 429, 45.0, 128, false, "rate_limited")

	// 3. Tick second 1
	ts, tick := agg.Tick(1)
	require.NotNil(t, ts)
	require.NotNil(t, tick)

	// Validate live sample logs
	assert.NotEmpty(t, tick.RecentLogs)
	var foundFeed, foundCheckout bool
	for _, log := range tick.RecentLogs {
		if log.Path == "/api/v1/feed" {
			foundFeed = true
			assert.Equal(t, 200, log.StatusCode)
			assert.False(t, log.IsError)
		}
		if log.Path == "/api/v1/checkout" {
			foundCheckout = true
			assert.True(t, log.IsError)
			assert.NotEmpty(t, log.Error)
		}
	}
	assert.True(t, foundFeed, "Expected /api/v1/feed log sample")
	assert.True(t, foundCheckout, "Expected /api/v1/checkout error log")

	// Validate real-time per-endpoint health
	require.Len(t, tick.EndpointHealth, 2)
	for _, health := range tick.EndpointHealth {
		if health.Path == "/api/v1/feed" {
			assert.Equal(t, "healthy", health.Status)
			assert.Equal(t, 0.0, health.ErrorRate)
			assert.Equal(t, float64(20), health.CurrentRPS)
		}
		if health.Path == "/api/v1/checkout" {
			// 100% error rate on checkout
			assert.Equal(t, "failing", health.Status)
			assert.Greater(t, health.ErrorRate, 0.5)
			assert.NotEmpty(t, health.FirstBrokeReason)
			assert.Greater(t, health.FirstBrokeAtRPS, 0.0)
		}
	}

	// 4. Finish test and check first bottleneck detection
	results, _ := agg.Finish(10)
	require.NotNil(t, results.Summary.FirstBottleneck)
	assert.Equal(t, "/api/v1/checkout", results.Summary.FirstBottleneck.Path)
	assert.Equal(t, "POST", results.Summary.FirstBottleneck.Method)
	assert.Equal(t, 1, results.Summary.FirstBottleneck.BrokeAtSecond)
}

func TestOpenRunner_With_LiveLogsStream(t *testing.T) {
	target := domain.LoadTestTarget{Method: "GET", Path: "/health", Weight: 1}
	dispatcher := loadengine.NewHTTPDispatcher("https://example.com", []domain.LoadTestTarget{target}, nil)
	aggregator := loadengine.NewAggregator("test-runner-002")
	runner := loadengine.NewOpenRunner(dispatcher, aggregator)

	cfg := domain.LoadTestConfig{
		Profile:         domain.ProfileSustained,
		StartRate:       10,
		PeakRate:        10,
		DurationSeconds: 1,
		TimeoutMS:       200,
	}

	ticksEmitted := 0
	onTick := func(ts *domain.LoadTestTimeseries, tick domain.SSEProgressTickData) {
		ticksEmitted++
		assert.Equal(t, 0, tick.T)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	err := runner.Run(ctx, cfg, onTick)
	assert.NoError(t, err)
	assert.Equal(t, 1, ticksEmitted)
}
