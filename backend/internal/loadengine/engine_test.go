package loadengine_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/loadengine"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEngine_OpenModel_Sustained(t *testing.T) {
	var requestCount atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		time.Sleep(5 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()

	engine := loadengine.NewEngine()

	cfg := domain.LoadTestConfig{
		Model:   domain.ModelOpen,
		Profile: domain.ProfileSustained,
		Targets: []domain.LoadTestTarget{
			{Method: "GET", Path: "/api/test", Weight: 1},
		},
		StartRate:       20,
		DurationSeconds: 2,
		MaxVirtualUsers: 50,
		TimeoutMS:       2000,
	}

	var ticks []domain.SSEProgressTickData
	results, hist, err := engine.Run(
		context.Background(),
		"test-open-1",
		server.URL,
		cfg,
		func(ts *domain.LoadTestTimeseries, tick domain.SSEProgressTickData) {
			ticks = append(ticks, tick)
		},
	)

	require.NoError(t, err)
	assert.Greater(t, requestCount.Load(), int64(10))
	assert.Greater(t, results.Summary.TotalRequests, int64(10))
	assert.Equal(t, results.Summary.TotalRequests, results.Summary.Successful)
	assert.Equal(t, int64(0), results.Summary.Failed)
	assert.Greater(t, results.Summary.LatencyMS.P50, 0.0)
	assert.NotNil(t, hist)
	assert.Equal(t, 2, len(ticks))
}

func TestEngine_ClosedModel(t *testing.T) {
	var requestCount atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	engine := loadengine.NewEngine()

	cfg := domain.LoadTestConfig{
		Model:   domain.ModelClosed,
		Profile: domain.ProfileSustained,
		Targets: []domain.LoadTestTarget{
			{Method: "GET", Path: "/ping", Weight: 1},
		},
		MaxVirtualUsers: 5,
		DurationSeconds: 2,
		ThinkTimeMS:     10,
		TimeoutMS:       1000,
	}

	results, _, err := engine.Run(
		context.Background(),
		"test-closed-1",
		server.URL,
		cfg,
		nil,
	)

	require.NoError(t, err)
	assert.Greater(t, requestCount.Load(), int64(5))
	assert.Greater(t, results.Summary.TotalRequests, int64(5))
}

func TestEngine_StopCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(10 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	engine := loadengine.NewEngine()

	cfg := domain.LoadTestConfig{
		Model:   domain.ModelOpen,
		Profile: domain.ProfileSustained,
		Targets: []domain.LoadTestTarget{
			{Method: "GET", Path: "/slow", Weight: 1},
		},
		StartRate:       50,
		DurationSeconds: 30, // Long test
		MaxVirtualUsers: 50,
		TimeoutMS:       2000,
	}

	ctx, cancel := context.WithCancel(context.Background())

	// Cancel after 150ms
	go func() {
		time.Sleep(150 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	_, _, _ = engine.Run(
		ctx,
		"test-cancel-1",
		server.URL,
		cfg,
		nil,
	)
	elapsed := time.Since(start)

	// Must stop well before 30s, typically < 1s
	assert.Less(t, elapsed, 2500*time.Millisecond)
}
