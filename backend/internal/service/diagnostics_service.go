package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// DiagnosticsService provides root cause analysis, slow endpoint rankings,
// performance regression detection, and architectural bottleneck hints.
type DiagnosticsService interface {
	GetSlowEndpoints(ctx context.Context, projectID string, query domain.SlowEndpointsQuery) (*domain.SlowEndpointsResponse, error)
	GetRegressions(ctx context.Context, projectID string, query domain.RegressionsQuery) (*domain.RegressionsResponse, error)
	GetBottlenecks(ctx context.Context, projectID string, timeRange string) (*domain.BottlenecksResponse, error)
}

type diagnosticsService struct {
	store        ingest.TimeSeriesStore
	endpointRepo repository.EndpointRepository
	loadTestRepo repository.LoadTestRepository
	projectRepo  repository.ProjectRepository
	clock        clock.Clock
}

// NewDiagnosticsService creates a new DiagnosticsService instance.
func NewDiagnosticsService(
	store ingest.TimeSeriesStore,
	endpointRepo repository.EndpointRepository,
	loadTestRepo repository.LoadTestRepository,
	projectRepo repository.ProjectRepository,
	clk clock.Clock,
) DiagnosticsService {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	return &diagnosticsService{
		store:        store,
		endpointRepo: endpointRepo,
		loadTestRepo: loadTestRepo,
		projectRepo:  projectRepo,
		clock:        clk,
	}
}

type endpointAggregate struct {
	EndpointID string
	Method     string
	Route      string
	Service    string
	Requests   int64
	Durations  []float64
	Errors     int64
	SumDurMS   float64
}

// GetSlowEndpoints ranks endpoints by volume-weighted impact score (P95 * Requests).
func (s *diagnosticsService) GetSlowEndpoints(ctx context.Context, projectID string, query domain.SlowEndpointsQuery) (*domain.SlowEndpointsResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	start, end, rangeLabel := s.resolveTimeBounds(query.Range, query.Start, query.End)
	minReqs := query.MinRequests
	if minReqs <= 0 {
		minReqs = 10
	}
	limit := query.Limit
	if limit <= 0 {
		limit = 10
	} else if limit > 50 {
		limit = 50
	}

	aggregates, err := s.collectEndpointAggregates(ctx, projectID, start, end)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	// Lookup known registered endpoints to populate EndpointID and Service
	epMap := s.getKnownEndpointMap(ctx, projectID)

	var items []domain.SlowEndpointItem
	for _, agg := range aggregates {
		if agg.Requests < int64(minReqs) {
			continue
		}

		p50, p95, p99 := calculatePercentiles(agg.Durations)
		errorRate := 0.0
		if agg.Requests > 0 {
			errorRate = float64(agg.Errors) / float64(agg.Requests)
		}

		key := fmt.Sprintf("%s %s", agg.Method, agg.Route)
		endpointID := ""
		serviceName := agg.Service
		if ep, ok := epMap[key]; ok {
			endpointID = ep.ID
			if ep.Service != "" {
				serviceName = ep.Service
			}
		}

		// Volume-weighted impact score
		impactScore := math.Round(float64(agg.Requests)*p95*10) / 10

		items = append(items, domain.SlowEndpointItem{
			EndpointID:  endpointID,
			Method:      agg.Method,
			Route:       agg.Route,
			Service:     serviceName,
			Requests:    agg.Requests,
			P50MS:       math.Round(p50*10) / 10,
			P95MS:       math.Round(p95*10) / 10,
			P99MS:       math.Round(p99*10) / 10,
			ErrorRate:   math.Round(errorRate*10000) / 10000,
			ImpactScore: impactScore,
		})
	}

	// Sort descending by impact score
	sort.Slice(items, func(i, j int) bool {
		return items[i].ImpactScore > items[j].ImpactScore
	})

	totalEvaluated := len(items)
	if len(items) > limit {
		items = items[:limit]
	}

	return &domain.SlowEndpointsResponse{
		Range:          rangeLabel,
		TotalEvaluated: totalEvaluated,
		Endpoints:      items,
	}, nil
}

// GetRegressions detects performance degradation between current window and baseline.
func (s *diagnosticsService) GetRegressions(ctx context.Context, projectID string, query domain.RegressionsQuery) (*domain.RegressionsResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	start, end, rangeLabel := s.resolveTimeBounds(query.Range, query.Start, query.End)
	thresholdPct := query.ThresholdPct
	if thresholdPct <= 0 {
		thresholdPct = 10.0
	}
	baseline := strings.TrimSpace(query.Baseline)
	if baseline == "" {
		baseline = "previous"
	}

	// Current window metrics
	currentAggs, err := s.collectEndpointAggregates(ctx, projectID, start, end)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	// Baseline metrics map: key -> {p95, errorRate}
	type baselineMetric struct {
		P95       float64
		ErrorRate float64
	}
	baselineMap := make(map[string]baselineMetric)

	if baseline == "previous" {
		windowDuration := end.Sub(start)
		baseStart := start.Add(-windowDuration)
		baseEnd := start
		baseAggs, err := s.collectEndpointAggregates(ctx, projectID, baseStart, baseEnd)
		if err == nil {
			for _, agg := range baseAggs {
				_, p95, _ := calculatePercentiles(agg.Durations)
				errRate := 0.0
				if agg.Requests > 0 {
					errRate = float64(agg.Errors) / float64(agg.Requests)
				}
				key := fmt.Sprintf("%s %s", agg.Method, agg.Route)
				baselineMap[key] = baselineMetric{P95: p95, ErrorRate: errRate}
			}
		}
	} else if strings.HasPrefix(baseline, "test:") {
		testID := strings.TrimPrefix(baseline, "test:")
		results, err := s.loadTestRepo.GetResults(ctx, testID)
		if err != nil || results == nil {
			return nil, domain.NewNotFoundError("Baseline load test results not found")
		}

		if len(results.PerEndpoint) > 0 {
			var perEndpoint []domain.PerEndpointResult
			if b, err := json.Marshal(results.PerEndpoint); err == nil {
				if json.Unmarshal(b, &perEndpoint) != nil {
					var wrapper struct {
						Items []domain.PerEndpointResult `json:"items"`
					}
					if json.Unmarshal(b, &wrapper) == nil {
						perEndpoint = wrapper.Items
					}
				}
				for _, ep := range perEndpoint {
					key := fmt.Sprintf("%s %s", ep.Method, ep.Path)
					baselineMap[key] = baselineMetric{P95: ep.LatencyMS.P95, ErrorRate: ep.ErrorRate}
				}
			}
		}
	} else {
		return nil, domain.NewValidationError("Invalid baseline parameter; must be 'previous' or 'test:{id}'", nil)
	}

	epMap := s.getKnownEndpointMap(ctx, projectID)
	var regressions []domain.RegressionItem

	for _, cur := range currentAggs {
		key := fmt.Sprintf("%s %s", cur.Method, cur.Route)
		base, exists := baselineMap[key]
		if !exists || base.P95 <= 0 {
			continue
		}

		_, curP95, _ := calculatePercentiles(cur.Durations)
		curErrRate := 0.0
		if cur.Requests > 0 {
			curErrRate = float64(cur.Errors) / float64(cur.Requests)
		}

		endpointID := ""
		serviceName := cur.Service
		if ep, ok := epMap[key]; ok {
			endpointID = ep.ID
			if ep.Service != "" {
				serviceName = ep.Service
			}
		}

		// Check Latency Regression
		if curP95 > base.P95 {
			p95ChangePct := ((curP95 - base.P95) / base.P95) * 100.0
			if p95ChangePct >= thresholdPct {
				severity := domain.RegressionSeverityInfo
				if p95ChangePct >= 50.0 {
					severity = domain.RegressionSeverityCritical
				} else if p95ChangePct >= 20.0 {
					severity = domain.RegressionSeverityWarning
				}

				regressions = append(regressions, domain.RegressionItem{
					EndpointID:    endpointID,
					Method:        cur.Method,
					Route:         cur.Route,
					Service:       serviceName,
					Metric:        "p95_latency",
					BaselineValue: math.Round(base.P95*10) / 10,
					CurrentValue:  math.Round(curP95*10) / 10,
					ChangePct:     math.Round(p95ChangePct*10) / 10,
					Severity:      severity,
				})
			}
		}

		// Check Error Rate Regression (absolute percentage point change >= 1.0%)
		errDeltaPct := (curErrRate - base.ErrorRate) * 100.0
		if errDeltaPct >= 1.0 {
			severity := domain.RegressionSeverityInfo
			if errDeltaPct >= 5.0 {
				severity = domain.RegressionSeverityCritical
			} else if errDeltaPct >= 2.0 {
				severity = domain.RegressionSeverityWarning
			}

			regressions = append(regressions, domain.RegressionItem{
				EndpointID:    endpointID,
				Method:        cur.Method,
				Route:         cur.Route,
				Service:       serviceName,
				Metric:        "error_rate",
				BaselineValue: math.Round(base.ErrorRate*10000) / 10000,
				CurrentValue:  math.Round(curErrRate*10000) / 10000,
				ChangePct:     math.Round(errDeltaPct*10) / 10,
				Severity:      severity,
			})
		}
	}

	// Sort: critical first, then warning, then info, then change_pct desc
	sort.Slice(regressions, func(i, j int) bool {
		rank := func(sev string) int {
			switch sev {
			case domain.RegressionSeverityCritical:
				return 3
			case domain.RegressionSeverityWarning:
				return 2
			default:
				return 1
			}
		}
		if rank(regressions[i].Severity) != rank(regressions[j].Severity) {
			return rank(regressions[i].Severity) > rank(regressions[j].Severity)
		}
		return regressions[i].ChangePct > regressions[j].ChangePct
	})

	return &domain.RegressionsResponse{
		Baseline:     baseline,
		Range:        rangeLabel,
		ThresholdPct: thresholdPct,
		Regressions:  regressions,
	}, nil
}

// GetBottlenecks generates architectural correlation hints labeled explicitly as hints.
func (s *diagnosticsService) GetBottlenecks(ctx context.Context, projectID string, timeRange string) (*domain.BottlenecksResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	start, end, rangeLabel := s.resolveTimeBounds(timeRange, nil, nil)
	aggregates, err := s.collectEndpointAggregates(ctx, projectID, start, end)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	var hints []domain.BottleneckHint

	var totalRequests int64
	var totalExecutionTime float64
	var totalErrors int64

	for _, agg := range aggregates {
		totalRequests += agg.Requests
		totalExecutionTime += agg.SumDurMS
		totalErrors += agg.Errors
	}

	// 1. High Execution Time Concentration Check
	if totalExecutionTime > 0 {
		for _, agg := range aggregates {
			share := (agg.SumDurMS / totalExecutionTime) * 100.0
			if share >= 60.0 && agg.Requests >= 5 {
				hints = append(hints, domain.BottleneckHint{
					Kind:       "hint",
					Type:       domain.BottleneckTypeHighExecutionConcentration,
					Confidence: domain.ConfidenceHigh,
					Message: fmt.Sprintf(
						"Endpoint '%s %s' accounts for %.1f%% of cumulative server execution time. Optimizing this route will yield the highest return on overall system capacity.",
						agg.Method, agg.Route, share,
					),
					Evidence: map[string]interface{}{
						"method":      agg.Method,
						"route":       agg.Route,
						"share_pct":   math.Round(share*10) / 10,
						"duration_ms": math.Round(agg.SumDurMS*10) / 10,
						"requests":    agg.Requests,
					},
				})
			}
		}
	}

	// 2. Tail Latency Dispersion (Lock Contention / GC Pauses) Check
	for _, agg := range aggregates {
		if agg.Requests >= 10 {
			p50, _, p99 := calculatePercentiles(agg.Durations)
			if p50 > 0 && p99 >= 50.0 {
				ratio := p99 / p50
				if ratio >= 4.0 {
					hints = append(hints, domain.BottleneckHint{
						Kind:       "hint",
						Type:       domain.BottleneckTypeTailLatencyDispersion,
						Confidence: domain.ConfidenceMedium,
						Message: fmt.Sprintf(
							"High latency tail dispersion detected on '%s %s' (P99 is %.1fx higher than median). This is characteristic of database lock contention, downstream wait states, or GC pauses.",
							agg.Method, agg.Route, ratio,
						),
						Evidence: map[string]interface{}{
							"method": agg.Method,
							"route":  agg.Route,
							"p50_ms": math.Round(p50*10) / 10,
							"p99_ms": math.Round(p99*10) / 10,
							"ratio":  math.Round(ratio*10) / 10,
						},
					})
				}
			}
		}
	}

	// 3. Load-Correlated Error Spikes
	if totalRequests >= 20 {
		errorRate := float64(totalErrors) / float64(totalRequests)
		if errorRate >= 0.05 {
			hints = append(hints, domain.BottleneckHint{
				Kind:       "hint",
				Type:       domain.BottleneckTypeLoadCorrelatedErrors,
				Confidence: domain.ConfidenceHigh,
				Message:    "Elevated 5xx error rate detected across the system. Check for server-side thread saturation, database connection pool exhaustion, or external dependency failures under load.",
				Evidence: map[string]interface{}{
					"total_requests": totalRequests,
					"total_errors":   totalErrors,
					"error_rate_pct": math.Round(errorRate*1000) / 10,
				},
			})
		}
	}

	if hints == nil {
		hints = []domain.BottleneckHint{}
	}

	return &domain.BottlenecksResponse{
		Range: rangeLabel,
		Hints: hints,
	}, nil
}

// collectEndpointAggregates gathers raw and rollup metrics into unified endpoint aggregates.
func (s *diagnosticsService) collectEndpointAggregates(ctx context.Context, projectID string, start, end time.Time) ([]*endpointAggregate, error) {
	duration := end.Sub(start)
	aggMap := make(map[string]*endpointAggregate)

	// Always query raw events first (most accurate for percentiles)
	events, err := s.store.QueryEvents(ctx, projectID, start, end, 10000)
	if err == nil && len(events) > 0 {
		for _, e := range events {
			key := fmt.Sprintf("%s %s", e.Method, e.Route)
			agg, exists := aggMap[key]
			if !exists {
				agg = &endpointAggregate{
					Method:  e.Method,
					Route:   e.Route,
					Service: e.Service,
				}
				aggMap[key] = agg
			}
			agg.Requests++
			agg.Durations = append(agg.Durations, e.DurationMs)
			agg.SumDurMS += e.DurationMs
			if e.Status >= 400 {
				agg.Errors++
			}
		}
	}

	// If raw events were insufficient and duration is long, supplement with 1m or 1h rollups
	if len(aggMap) == 0 && duration > 15*time.Minute {
		rollups, rErr := s.store.QueryRollups1m(ctx, projectID, "", start, end)
		if rErr == nil && len(rollups) > 0 {
			for _, r := range rollups {
				agg, exists := aggMap[r.EndpointKey]
				if !exists {
					parts := strings.SplitN(r.EndpointKey, " ", 2)
					method := "GET"
					route := r.EndpointKey
					if len(parts) == 2 {
						method = parts[0]
						route = parts[1]
					}
					agg = &endpointAggregate{
						Method: method,
						Route:  route,
					}
					aggMap[r.EndpointKey] = agg
				}
				agg.Requests += r.Count
				agg.Errors += r.Errors
				agg.SumDurMS += r.SumMs
				if subHist, err := histogram.FromBytes(r.Histogram); err == nil && subHist != nil {
					agg.Durations = append(agg.Durations, subHist.Quantile(0.50), subHist.Quantile(0.95), subHist.Quantile(0.99))
				} else if r.Count > 0 {
					avg := r.SumMs / float64(r.Count)
					agg.Durations = append(agg.Durations, avg)
				}
			}
		}
	}

	var results []*endpointAggregate
	for _, agg := range aggMap {
		results = append(results, agg)
	}

	return results, nil
}

func (s *diagnosticsService) getKnownEndpointMap(ctx context.Context, projectID string) map[string]*domain.APIEndpoint {
	m := make(map[string]*domain.APIEndpoint)
	eps, _, err := s.endpointRepo.List(ctx, projectID, domain.ListEndpointsQuery{Limit: 100})
	if err == nil {
		for _, ep := range eps {
			key := fmt.Sprintf("%s %s", ep.Method, ep.PathTemplate)
			m[key] = ep
		}
	}
	return m
}

func (s *diagnosticsService) resolveTimeBounds(rangeStr string, startPtr, endPtr *time.Time) (time.Time, time.Time, string) {
	now := s.clock.Now().UTC()

	if startPtr != nil && endPtr != nil && endPtr.After(*startPtr) {
		return startPtr.UTC(), endPtr.UTC(), "custom"
	}

	var dur time.Duration
	var rangeLabel string
	switch strings.ToLower(strings.TrimSpace(rangeStr)) {
	case "15m":
		dur = 15 * time.Minute
		rangeLabel = "15m"
	case "6h":
		dur = 6 * time.Hour
		rangeLabel = "6h"
	case "24h":
		dur = 24 * time.Hour
		rangeLabel = "24h"
	case "7d":
		dur = 7 * 24 * time.Hour
		rangeLabel = "7d"
	case "30d":
		dur = 30 * 24 * time.Hour
		rangeLabel = "30d"
	default:
		dur = 1 * time.Hour
		rangeLabel = "1h"
	}

	return now.Add(-dur), now, rangeLabel
}

func calculatePercentiles(durations []float64) (p50, p95, p99 float64) {
	if len(durations) == 0 {
		return 0, 0, 0
	}

	sorted := make([]float64, len(durations))
	copy(sorted, durations)
	sort.Float64s(sorted)

	getPerc := func(pct float64) float64 {
		idx := int(math.Ceil(pct*float64(len(sorted)))) - 1
		if idx < 0 {
			idx = 0
		}
		if idx >= len(sorted) {
			idx = len(sorted) - 1
		}
		return sorted[idx]
	}

	return getPerc(0.50), getPerc(0.95), getPerc(0.99)
}
