package loadengine

import (
	"fmt"
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

	// Per-second window tracking
	windowRequests   int64
	windowErrors     int64
	windowHist       *histogram.Histogram
	firstBrokeAtRPS  float64
	firstBrokeReason string
	firstBrokeSecond int
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

	// Live log stream buffer for current second (adaptive sampling)
	windowLogs         []domain.LiveRequestLog
	windowSuccessCount int
	windowErrorCount   int

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
func (a *Aggregator) Record(target domain.LoadTestTarget, statusCode int, durationMs float64, bytes int64, isTimeout bool, errMsgs ...string) {
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

	// Determine error text
	var errText string
	if len(errMsgs) > 0 && errMsgs[0] != "" {
		errText = errMsgs[0]
	} else if isTimeout {
		errText = "timeout"
	} else if statusCode == 429 {
		errText = "rate_limited"
	} else if statusCode >= 500 {
		errText = fmt.Sprintf("HTTP %d", statusCode)
	} else if statusCode == 0 {
		errText = "connection_failed"
	}

	// Capture live log sample (adaptive rate limit to protect SSE bandwidth & browser DOM)
	// Normal: sample up to 15 per second
	// Errors: sample up to 35 per second (prioritize failing requests)
	shouldCapture := false
	if isError {
		if a.windowErrorCount < 35 {
			a.windowErrorCount++
			shouldCapture = true
		}
	} else {
		if a.windowSuccessCount < 15 {
			a.windowSuccessCount++
			shouldCapture = true
		}
	}

	if shouldCapture {
		nowFormatted := time.Now().UTC().Format("15:04:05.000")
		a.windowLogs = append(a.windowLogs, domain.LiveRequestLog{
			Time:       nowFormatted,
			Method:     target.Method,
			Path:       target.Path,
			StatusCode: statusCode,
			LatencyMS:  durationMs,
			Bytes:      bytes,
			Error:      errText,
			IsError:    isError,
		})
	}

	endpointKey := target.Method + " " + target.Path
	ep, exists := a.perEndpoint[endpointKey]
	if !exists {
		ep = &endpointStats{
			method:     target.Method,
			path:       target.Path,
			histogram:  histogram.NewHistogram(),
			windowHist: histogram.NewHistogram(),
		}
		a.perEndpoint[endpointKey] = ep
	}
	ep.requests++
	ep.windowRequests++
	if isError {
		ep.errors++
		ep.windowErrors++
	}
	ep.histogram.Add(durationMs)
	if ep.windowHist == nil {
		ep.windowHist = histogram.NewHistogram()
	}
	ep.windowHist.Add(durationMs)
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

	// Compute real-time per-endpoint health and degradation status
	endpointHealthList := make([]domain.LiveEndpointHealth, 0, len(a.perEndpoint))
	for _, ep := range a.perEndpoint {
		currRPS := float64(ep.windowRequests)
		epP95 := 0.0
		if ep.windowHist != nil && ep.windowHist.Count > 0 {
			epP95 = ep.windowHist.Quantile(0.95)
		} else if ep.histogram != nil && ep.histogram.Count > 0 {
			epP95 = ep.histogram.Quantile(0.95)
		}

		errRate := 0.0
		if ep.windowRequests > 0 {
			errRate = float64(ep.windowErrors) / float64(ep.windowRequests)
		}

		status := "healthy"
		if errRate >= 0.05 || epP95 >= 1500.0 {
			status = "failing"
		} else if errRate >= 0.01 || epP95 >= 500.0 {
			status = "degraded"
		}

		// Detect and record first breaking point
		if status != "healthy" && ep.firstBrokeAtRPS == 0 && achieved > 0 {
			ep.firstBrokeAtRPS = achieved
			ep.firstBrokeSecond = second
			ep.firstBrokeReason = fmt.Sprintf("Broke at %.0f RPS (p95: %.1fms, err: %.1f%%)", achieved, epP95, errRate*100)
		}

		endpointHealthList = append(endpointHealthList, domain.LiveEndpointHealth{
			Method:           ep.method,
			Path:             ep.path,
			TotalRequests:    ep.requests,
			CurrentRPS:       currRPS,
			P95LatencyMS:     epP95,
			ErrorRate:        errRate,
			Status:           status,
			FirstBrokeAtRPS:  ep.firstBrokeAtRPS,
			FirstBrokeReason: ep.firstBrokeReason,
		})

		// Reset window counters for this endpoint
		ep.windowRequests = 0
		ep.windowErrors = 0
		ep.windowHist = histogram.NewHistogram()
	}

	// Extract recent logs for this tick
	recentLogs := make([]domain.LiveRequestLog, len(a.windowLogs))
	copy(recentLogs, a.windowLogs)

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
		T:              second,
		OfferedRPS:     a.windowOfferedRPS,
		AchievedRPS:    achieved,
		P50:            p50,
		P95:            p95,
		P99:            p99,
		Errors:         int(a.windowErrors),
		Active:         activeCount,
		TotalRequests:  a.totalRequests,
		StatusCodes:    statusCodesMap,
		RecentLogs:     recentLogs,
		EndpointHealth: endpointHealthList,
	}

	// Reset window counters for next 1-second interval
	a.windowAchieved = 0
	a.windowErrors = 0
	a.windowOfferedRPS = 0
	a.windowCodes = make(map[int]int64)
	a.windowHist = histogram.NewHistogram()
	a.windowLogs = nil
	a.windowSuccessCount = 0
	a.windowErrorCount = 0

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

	// Detect earliest bottleneck across all endpoints
	var earliestBottleneck *domain.BottleneckInsight
	earliestSec := 9999999
	for _, ep := range a.perEndpoint {
		if ep.firstBrokeAtRPS > 0 && ep.firstBrokeSecond < earliestSec {
			earliestSec = ep.firstBrokeSecond
			p95 := 0.0
			if ep.histogram != nil {
				p95 = ep.histogram.Quantile(0.95)
			}
			errRate := 0.0
			if ep.requests > 0 {
				errRate = float64(ep.errors) / float64(ep.requests)
			}
			earliestBottleneck = &domain.BottleneckInsight{
				Method:        ep.method,
				Path:          ep.path,
				BrokeAtSecond: ep.firstBrokeSecond,
				BrokeAtRPS:    ep.firstBrokeAtRPS,
				P95LatencyMS:  p95,
				ErrorRate:     errRate,
				Reason:        ep.firstBrokeReason,
			}
		}
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
		FirstBottleneck: earliestBottleneck,
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
