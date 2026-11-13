package loadengine

import (
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
	"github.com/google/uuid"
)

type endpointStats struct {
	method    string
	path      string
	requests  int64
	errors    int64
	histogram *histogram.Histogram
}

// Aggregator collects real-time per-second window metrics and cumulative test results.
type Aggregator struct {
	mu     sync.Mutex
	testID string

	// In-flight active concurrency
	active atomic.Int64

	// Generator lag metrics
	generatorSaturated atomic.Bool
	maxScheduleLagMS   atomic.Int64

	// Current 1-second window state
	windowOfferedRPS float64
	windowAchieved   int64
	windowErrors     int64
	windowCodes      map[int]int64
	windowHist       *histogram.Histogram

	// Cumulative overall metrics
	totalRequests   int64
	successful      int64
	failed          int64
	timeouts        int64
	bytesReceived   int64
	allCodes        map[int]int64
	overallHist     *histogram.Histogram
	perEndpoint     map[string]*endpointStats
	peakAchievedRPS float64
}

// NewAggregator instantiates a new thread-safe aggregator for a test.
func NewAggregator(testID string) *Aggregator {
	return &Aggregator{
		testID:      testID,
		windowCodes: make(map[int]int64),
		windowHist:  histogram.NewHistogram(),
		allCodes:    make(map[int]int64),
		overallHist: histogram.NewHistogram(),
		perEndpoint: make(map[string]*endpointStats),
	}
}

// SetOfferedRPS sets the target offered RPS for the current second window.
func (a *Aggregator) SetOfferedRPS(rate float64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.windowOfferedRPS = rate
}

// IncActive increments the count of in-flight requests.
func (a *Aggregator) IncActive() {
	a.active.Add(1)
}

// DecActive decrements the count of in-flight requests.
func (a *Aggregator) DecActive() {
	a.active.Add(-1)
}

// RecordLag tracks schedule lag and flags generator saturation if threshold exceeded.
func (a *Aggregator) RecordLag(lagMs int64) {
	if lagMs > 100 {
		a.generatorSaturated.Store(true)
	}
	for {
		cur := a.maxScheduleLagMS.Load()
		if lagMs <= cur {
			break
		}
		if a.maxScheduleLagMS.CompareAndSwap(cur, lagMs) {
			break
		}
	}
}

// Record ingests an individual HTTP request result into both window and cumulative metrics.
func (a *Aggregator) Record(target domain.LoadTestTarget, statusCode int, durationMs float64, bytes int64, isTimeout bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.windowAchieved++
	a.totalRequests++
	a.bytesReceived += bytes

	isError := isTimeout || statusCode >= 400 || statusCode == 0
	if isError {
		a.windowErrors++
		a.failed++
	} else {
		a.successful++
	}

	if isTimeout {
		a.timeouts++
	}

	a.windowCodes[statusCode]++
	a.allCodes[statusCode]++

	a.windowHist.Add(durationMs)
	a.overallHist.Add(durationMs)

	endpointKey := target.Method + " " + target.Path
	ep, exists := a.perEndpoint[endpointKey]
	if !exists {
		ep = &endpointStats{
			method:    target.Method,
			path:      target.Path,
			histogram: histogram.NewHistogram(),
		}
		a.perEndpoint[endpointKey] = ep
	}
	ep.requests++
	if isError {
		ep.errors++
	}
	ep.histogram.Add(durationMs)
}

// Tick compiles and flushes the metrics for second t, resetting window counters for next tick.
func (a *Aggregator) Tick(second int) (*domain.LoadTestTimeseries, domain.SSEProgressTickData) {
	a.mu.Lock()
	defer a.mu.Unlock()

	achieved := float64(a.windowAchieved)
	if achieved > a.peakAchievedRPS {
		a.peakAchievedRPS = achieved
	}

	p50 := a.windowHist.Quantile(0.50)
	p95 := a.windowHist.Quantile(0.95)
	p99 := a.windowHist.Quantile(0.99)

	statusCodesMap := make(map[string]int64, len(a.windowCodes))
	statusCodesJSON := make(domain.JSONMap, len(a.windowCodes))
	for code, count := range a.windowCodes {
		key := strconv.Itoa(code)
		statusCodesMap[key] = count
		statusCodesJSON[key] = count
	}

	activeCount := int(a.active.Load())
	if activeCount < 0 {
		activeCount = 0
	}

	ts := &domain.LoadTestTimeseries{
		ID:           uuid.NewString(),
		TestID:       a.testID,
		Second:       second,
		OfferedRPS:   a.windowOfferedRPS,
		AchievedRPS:  achieved,
		Errors:       int(a.windowErrors),
		P50:          p50,
		P95:          p95,
		P99:          p99,
		StatusCounts: statusCodesJSON,
		Active:       activeCount,
		CreatedAt:    time.Now().UTC(),
	}

	tickData := domain.SSEProgressTickData{
		T:             second,
		OfferedRPS:    a.windowOfferedRPS,
		AchievedRPS:   achieved,
		P50:           p50,
		P95:           p95,
		P99:           p99,
		Errors:        int(a.windowErrors),
		Active:        activeCount,
		TotalRequests: a.totalRequests,
		StatusCodes:   statusCodesMap,
	}

	// Reset window counters for next 1-second interval
	a.windowAchieved = 0
	a.windowErrors = 0
	a.windowOfferedRPS = 0
	a.windowCodes = make(map[int]int64)
	a.windowHist = histogram.NewHistogram()

	return ts, tickData
}

// Finish assembles the final test results summary, endpoint breakdowns, and flags.
func (a *Aggregator) Finish(durationSeconds int) (domain.LoadTestResultsResponse, *histogram.Histogram) {
	a.mu.Lock()
	defer a.mu.Unlock()

	effectiveDuration := float64(durationSeconds)
	if effectiveDuration <= 0 {
		effectiveDuration = 1.0
	}

	avgRPS := float64(a.totalRequests) / effectiveDuration
	errorRate := 0.0
	if a.totalRequests > 0 {
		errorRate = float64(a.failed) / float64(a.totalRequests)
	}

	avgLatency := 0.0
	if a.overallHist.Count > 0 {
		avgLatency = a.overallHist.Sum / float64(a.overallHist.Count)
	}

	latencySummary := domain.LoadTestLatencySummary{
		P50: a.overallHist.Quantile(0.50),
		P90: a.overallHist.Quantile(0.90),
		P95: a.overallHist.Quantile(0.95),
		P99: a.overallHist.Quantile(0.99),
		Max: a.overallHist.Max,
		Avg: avgLatency,
	}

	statusCodesMap := make(map[string]int64, len(a.allCodes))
	for code, count := range a.allCodes {
		statusCodesMap[strconv.Itoa(code)] = count
	}

	summary := domain.LoadTestSummary{
		TotalRequests:   a.totalRequests,
		Successful:      a.successful,
		Failed:          a.failed,
		AvgRPS:          avgRPS,
		PeakRPS:         a.peakAchievedRPS,
		LatencyMS:       latencySummary,
		ErrorRate:       errorRate,
		Timeouts:        a.timeouts,
		StatusCodes:     statusCodesMap,
		BytesReceived:   a.bytesReceived,
		DurationSeconds: durationSeconds,
	}

	perEndpointList := make([]domain.PerEndpointResult, 0, len(a.perEndpoint))
	for _, ep := range a.perEndpoint {
		epErrRate := 0.0
		if ep.requests > 0 {
			epErrRate = float64(ep.errors) / float64(ep.requests)
		}

		epAvg := 0.0
		if ep.histogram.Count > 0 {
			epAvg = ep.histogram.Sum / float64(ep.histogram.Count)
		}

		perEndpointList = append(perEndpointList, domain.PerEndpointResult{
			Method:    ep.method,
			Path:      ep.path,
			Requests:  ep.requests,
			ErrorRate: epErrRate,
			LatencyMS: domain.LoadTestLatencySummary{
				P50: ep.histogram.Quantile(0.50),
				P90: ep.histogram.Quantile(0.90),
				P95: ep.histogram.Quantile(0.95),
				P99: ep.histogram.Quantile(0.99),
				Max: ep.histogram.Max,
				Avg: epAvg,
			},
		})
	}

	// Calculate latency distribution from overall histogram buckets
	boundaries := histogram.BucketBoundaries()
	dist := make([]domain.LatencyDistributionBucket, 0)
	var cumulativeCount int64
	for i := 0; i < histogram.NumBuckets; i++ {
		count := int64(a.overallHist.Buckets[i])
		if count > 0 {
			cumulativeCount += count
			dist = append(dist, domain.LatencyDistributionBucket{
				LeMS:  boundaries[i+1],
				Count: cumulativeCount,
			})
		}
	}

	flags := domain.LoadTestFlags{
		GeneratorSaturated: a.generatorSaturated.Load(),
		MaxScheduleLagMS:   a.maxScheduleLagMS.Load(),
	}

	res := domain.LoadTestResultsResponse{
		Summary:             summary,
		PerEndpoint:         perEndpointList,
		LatencyDistribution: dist,
		Flags:               flags,
	}

	return res, a.overallHist
}
