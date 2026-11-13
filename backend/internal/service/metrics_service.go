package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/histogram"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// MetricsQuery defines standard filtering parameters for metrics operations.
type MetricsQuery struct {
	Range      string
	From       string
	To         string
	EndpointID string
}

// TimeseriesQuery defines parameters for granular time-series data queries.
type TimeseriesQuery struct {
	MetricsQuery
	Metric  string
	Step    string
	GroupBy string
}

// EndpointsMetricsQuery defines sorting, pagination and filtering for endpoint metrics.
type EndpointsMetricsQuery struct {
	MetricsQuery
	Sort   string
	Limit  int
	Cursor string
	Search string
}

// HostsMetricsQuery defines parameters for host system metrics queries.
type HostsMetricsQuery struct {
	MetricsQuery
	Host   string
	Metric string
}

// MetricsService provides analytical aggregations and real-time observability data.
type MetricsService interface {
	GetOverview(ctx context.Context, projectID string, query MetricsQuery) (*domain.MetricsOverviewResponse, error)
	GetTimeseries(ctx context.Context, projectID string, query TimeseriesQuery) (*domain.MetricTimeseriesResponse, error)
	GetEndpointsMetrics(ctx context.Context, projectID string, query EndpointsMetricsQuery) ([]*domain.EndpointMetricItem, error)
	GetStatusCodes(ctx context.Context, projectID string, query MetricsQuery) (*domain.StatusCodesResponse, error)
	GetHostsMetrics(ctx context.Context, projectID string, query HostsMetricsQuery) (*domain.HostsMetricsResponse, error)
}

type metricsService struct {
	store        ingest.TimeSeriesStore
	endpointRepo repository.EndpointRepository
	projectRepo  repository.ProjectRepository
	cache        cache.MetricsCache
	clock        clock.Clock
}

// NewMetricsService instantiates a MetricsService.
func NewMetricsService(
	store ingest.TimeSeriesStore,
	endpointRepo repository.EndpointRepository,
	projectRepo repository.ProjectRepository,
	metricsCache cache.MetricsCache,
	clk clock.Clock,
) MetricsService {
	if clk == nil {
		clk = clock.NewRealClock()
	}
	return &metricsService{
		store:        store,
		endpointRepo: endpointRepo,
		projectRepo:  projectRepo,
		cache:        metricsCache,
		clock:        clk,
	}
}

// ParseTimeRange resolves range or from/to into a concrete TimeRange and selects step.
func ParseTimeRange(clk clock.Clock, rangeStr, fromStr, toStr, stepStr string) (domain.TimeRange, error) {
	now := clk.Now().UTC()
	var start, end time.Time

	if fromStr != "" && toStr != "" {
		f, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			return domain.TimeRange{}, domain.NewBadRequestError("invalid 'from' timestamp (RFC3339 required)", err)
		}
		t, err := time.Parse(time.RFC3339, toStr)
		if err != nil {
			return domain.TimeRange{}, domain.NewBadRequestError("invalid 'to' timestamp (RFC3339 required)", err)
		}
		if !t.After(f) {
			return domain.TimeRange{}, domain.NewBadRequestError("'to' must be strictly after 'from'", nil)
		}
		start = f.UTC()
		end = t.UTC()
	} else {
		duration := parseRelativeRange(rangeStr)
		end = now
		start = now.Add(-duration)
	}

	duration := end.Sub(start)
	step := parseStep(stepStr, duration)

	return domain.TimeRange{
		Start:    start,
		End:      end,
		Duration: duration,
		Step:     step,
	}, nil
}

func parseRelativeRange(rangeStr string) time.Duration {
	switch strings.ToLower(strings.TrimSpace(rangeStr)) {
	case "15m":
		return 15 * time.Minute
	case "6h":
		return 6 * time.Hour
	case "24h":
		return 24 * time.Hour
	case "7d":
		return 7 * 24 * time.Hour
	case "30d":
		return 30 * 24 * time.Hour
	case "1h":
		return 1 * time.Hour
	default:
		return 1 * time.Hour
	}
}

func parseStep(stepStr string, totalDuration time.Duration) time.Duration {
	switch strings.ToLower(strings.TrimSpace(stepStr)) {
	case "10s":
		return 10 * time.Second
	case "1m":
		return 1 * time.Minute
	case "5m":
		return 5 * time.Minute
	case "1h":
		return 1 * time.Hour
	}

	// Auto-select step so points <= 500
	if totalDuration <= 15*time.Minute {
		return 10 * time.Second
	} else if totalDuration <= 6*time.Hour {
		return 1 * time.Minute
	} else if totalDuration <= 24*time.Hour {
		return 5 * time.Minute
	} else if totalDuration <= 7*24*time.Hour {
		return 1 * time.Hour
	}
	return 6 * time.Hour
}

func hashQuery(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte("|"))
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// ClassifyEndpointHealth determines endpoint health status based on throughput, p95 latency, and error rate.
func ClassifyEndpointHealth(requests int64, p95, errorRate float64) domain.ProjectHealth {
	if requests == 0 {
		return domain.HealthNoData
	}
	if errorRate >= 0.05 || p95 >= 2000.0 {
		return domain.HealthFailing
	}
	if errorRate >= 0.01 || p95 >= 500.0 {
		return domain.HealthDegraded
	}
	return domain.HealthHealthy
}

// GetOverview computes KPI metrics for the current window and previous comparative window.
func (s *metricsService) GetOverview(ctx context.Context, projectID string, query MetricsQuery) (*domain.MetricsOverviewResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	tr, err := ParseTimeRange(s.clock, query.Range, query.From, query.To, "")
	if err != nil {
		return nil, err
	}

	qHash := hashQuery("overview", query.Range, query.From, query.To, query.EndpointID)
	if s.cache != nil {
		if cached, ok := s.cache.GetOverview(projectID, qHash); ok {
			return cached, nil
		}
	}

	endpointKey, err := s.resolveEndpointKey(ctx, projectID, query.EndpointID)
	if err != nil {
		return nil, err
	}

	currentSummary, err := s.aggregateWindow(ctx, projectID, endpointKey, tr.Start, tr.End, tr.Duration)
	if err != nil {
		return nil, err
	}

	prevStart := tr.Start.Add(-tr.Duration)
	prevEnd := tr.Start
	prevSummary, err := s.aggregateWindow(ctx, projectID, endpointKey, prevStart, prevEnd, tr.Duration)
	if err != nil {
		return nil, err
	}

	res := &domain.MetricsOverviewResponse{
		Current: currentSummary,
		Previous: domain.PreviousSummary{
			Requests:  prevSummary.Requests,
			RPS:       prevSummary.RPS,
			P95:       prevSummary.P95,
			ErrorRate: prevSummary.ErrorRate,
		},
	}

	if s.cache != nil {
		s.cache.SetOverview(projectID, qHash, res, 10*time.Second)
	}

	return res, nil
}

// aggregateWindow queries the appropriate tier (raw, 1m, 1h) and aggregates summary metrics.
func (s *metricsService) aggregateWindow(ctx context.Context, projectID, endpointKey string, start, end time.Time, duration time.Duration) (domain.MetricSummary, error) {
	secs := duration.Seconds()
	if secs <= 0 {
		secs = 1
	}

	// 1. Raw events tier (<= 15m)
	if duration <= 15*time.Minute {
		events, err := s.store.QueryEvents(ctx, projectID, start, end, 10000)
		if err != nil {
			return domain.MetricSummary{}, err
		}

		hist := histogram.NewHistogram()
		var total, errors int64

		for _, e := range events {
			if endpointKey != "" && fmt.Sprintf("%s %s", e.Method, e.Route) != endpointKey {
				continue
			}
			total++
			if e.IsError || e.Status >= 400 || e.Status == 0 {
				errors++
			}
			hist.Add(e.DurationMs)
		}

		return buildSummary(total, errors, secs, hist), nil
	}

	// 2. 1-minute rollups tier (<= 24h)
	if duration <= 24*time.Hour {
		rollups, err := s.store.QueryRollups1m(ctx, projectID, endpointKey, start, end)
		if err != nil {
			return domain.MetricSummary{}, err
		}

		hist := histogram.NewHistogram()
		var total, errors int64

		for _, r := range rollups {
			total += r.Count
			errors += r.Errors
			if subHist, err := histogram.FromBytes(r.Histogram); err == nil {
				hist.Merge(subHist)
			}
		}

		return buildSummary(total, errors, secs, hist), nil
	}

	// 3. 1-hour rollups tier (> 24h)
	rollups, err := s.store.QueryRollups1h(ctx, projectID, endpointKey, start, end)
	if err != nil {
		return domain.MetricSummary{}, err
	}

	hist := histogram.NewHistogram()
	var total, errors int64

	for _, r := range rollups {
		total += r.Count
		errors += r.Errors
		if subHist, err := histogram.FromBytes(r.Histogram); err == nil {
			hist.Merge(subHist)
		}
	}

	return buildSummary(total, errors, secs, hist), nil
}

func buildSummary(total, errors int64, secs float64, hist *histogram.Histogram) domain.MetricSummary {
	var errRate, successRate float64
	if total > 0 {
		errRate = float64(errors) / float64(total)
		successRate = 1.0 - errRate
	}

	pcts := hist.Percentiles()

	return domain.MetricSummary{
		Requests:    total,
		RPS:         float64(total) / secs,
		P50:         pcts["p50"],
		P90:         pcts["p90"],
		P95:         pcts["p95"],
		P99:         pcts["p99"],
		Avg:         pcts["avg"],
		Min:         pcts["min"],
		Max:         pcts["max"],
		ErrorRate:   errRate,
		SuccessRate: successRate,
		ErrorCount:  errors,
	}
}

// GetTimeseries builds timeseries charts with null points for empty intervals per API Spec 10.2.
func (s *metricsService) GetTimeseries(ctx context.Context, projectID string, query TimeseriesQuery) (*domain.MetricTimeseriesResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	tr, err := ParseTimeRange(s.clock, query.Range, query.From, query.To, query.Step)
	if err != nil {
		return nil, err
	}

	metricType := strings.ToLower(strings.TrimSpace(query.Metric))
	if metricType == "" {
		metricType = domain.MetricRPS
	}

	qHash := hashQuery("timeseries", query.Range, query.From, query.To, query.Step, metricType, query.EndpointID, query.GroupBy)
	if s.cache != nil {
		if cached, ok := s.cache.GetTimeseries(projectID, qHash); ok {
			return cached, nil
		}
	}

	endpointKey, err := s.resolveEndpointKey(ctx, projectID, query.EndpointID)
	if err != nil {
		return nil, err
	}

	// Generate discrete bucket timestamps
	numBuckets := int(tr.Duration / tr.Step)
	if numBuckets < 1 {
		numBuckets = 1
	} else if numBuckets > 500 {
		numBuckets = 500
	}

	bucketTimes := make([]time.Time, 0, numBuckets)
	cur := tr.Start.Truncate(tr.Step)
	for !cur.After(tr.End) {
		bucketTimes = append(bucketTimes, cur)
		cur = cur.Add(tr.Step)
	}

	type bucketData struct {
		count    int64
		errors   int64
		timeouts int64
		hist     *histogram.Histogram
	}

	// Series Map: seriesKey -> bucketTime -> bucketData
	seriesBuckets := make(map[string]map[time.Time]*bucketData)
	ensureSeriesBucket := func(seriesKey string, bTime time.Time) *bucketData {
		bMap, exists := seriesBuckets[seriesKey]
		if !exists {
			bMap = make(map[time.Time]*bucketData)
			seriesBuckets[seriesKey] = bMap
		}
		bd, ok := bMap[bTime]
		if !ok {
			bd = &bucketData{hist: histogram.NewHistogram()}
			bMap[bTime] = bd
		}
		return bd
	}

	// Multi-Tier Fetch
	if tr.Duration <= 15*time.Minute {
		events, err := s.store.QueryEvents(ctx, projectID, tr.Start, tr.End, 10000)
		if err != nil {
			return nil, err
		}

		for _, e := range events {
			epKey := fmt.Sprintf("%s %s", e.Method, e.Route)
			if endpointKey != "" && epKey != endpointKey {
				continue
			}

			seriesKey := s.determineSeriesKey(query.GroupBy, epKey, e.Status)
			bTime := e.Timestamp.UTC().Truncate(tr.Step)
			bd := ensureSeriesBucket(seriesKey, bTime)

			bd.count++
			if e.IsError || e.Status >= 400 || e.Status == 0 {
				bd.errors++
			}
			if e.Status == 0 || e.Status == 504 {
				bd.timeouts++
			}
			bd.hist.Add(e.DurationMs)
		}
	} else if tr.Duration <= 24*time.Hour {
		rollups, err := s.store.QueryRollups1m(ctx, projectID, endpointKey, tr.Start, tr.End)
		if err != nil {
			return nil, err
		}

		for _, r := range rollups {
			seriesKey := s.determineSeriesKeyFromRollup(query.GroupBy, r.EndpointKey, r.StatusCounts)
			bTime := r.Bucket.UTC().Truncate(tr.Step)
			bd := ensureSeriesBucket(seriesKey, bTime)

			bd.count += r.Count
			bd.errors += r.Errors
			if subHist, err := histogram.FromBytes(r.Histogram); err == nil {
				bd.hist.Merge(subHist)
			}
		}
	} else {
		rollups, err := s.store.QueryRollups1h(ctx, projectID, endpointKey, tr.Start, tr.End)
		if err != nil {
			return nil, err
		}

		for _, r := range rollups {
			seriesKey := s.determineSeriesKeyFromRollup(query.GroupBy, r.EndpointKey, r.StatusCounts)
			bTime := r.Bucket.UTC().Truncate(tr.Step)
			bd := ensureSeriesBucket(seriesKey, bTime)

			bd.count += r.Count
			bd.errors += r.Errors
			if subHist, err := histogram.FromBytes(r.Histogram); err == nil {
				bd.hist.Merge(subHist)
			}
		}
	}

	// If no series were created (no data at all), initialize "all"
	if len(seriesBuckets) == 0 {
		seriesBuckets["all"] = make(map[time.Time]*bucketData)
	}

	var seriesList []domain.TimeseriesSeries
	stepSecs := tr.Step.Seconds()
	if stepSecs <= 0 {
		stepSecs = 1
	}

	for sKey, bMap := range seriesBuckets {
		points := make([]domain.TimeseriesPoint, 0, len(bucketTimes))
		for _, bt := range bucketTimes {
			bd, hasData := bMap[bt]
			if !hasData || bd.count == 0 {
				points = append(points, domain.TimeseriesPoint{
					Timestamp: bt,
					Value:     nil, // missing bucket is null
				})
				continue
			}

			var val float64
			switch metricType {
			case domain.MetricRPS:
				val = float64(bd.count) / stepSecs
			case domain.MetricRequests:
				val = float64(bd.count)
			case domain.MetricP50:
				val = bd.hist.Quantile(0.50)
			case domain.MetricP95:
				val = bd.hist.Quantile(0.95)
			case domain.MetricP99:
				val = bd.hist.Quantile(0.99)
			case domain.MetricAvg:
				if bd.hist.Count > 0 {
					val = bd.hist.Sum / float64(bd.hist.Count)
				}
			case domain.MetricErrorRate:
				val = float64(bd.errors) / float64(bd.count)
			case domain.MetricSuccessRate:
				val = float64(bd.count-bd.errors) / float64(bd.count)
			case domain.MetricTimeouts:
				val = float64(bd.timeouts)
			default:
				val = float64(bd.count) / stepSecs
			}

			points = append(points, domain.TimeseriesPoint{
				Timestamp: bt,
				Value:     &val,
			})
		}

		seriesList = append(seriesList, domain.TimeseriesSeries{
			Key:    sKey,
			Points: points,
		})
	}

	// Sort series by Key
	sort.Slice(seriesList, func(i, j int) bool {
		return seriesList[i].Key < seriesList[j].Key
	})

	unit := "ms"
	if metricType == domain.MetricRPS {
		unit = "rps"
	} else if metricType == domain.MetricRequests || metricType == domain.MetricTimeouts {
		unit = "count"
	} else if metricType == domain.MetricErrorRate || metricType == domain.MetricSuccessRate {
		unit = "ratio"
	}

	resp := &domain.MetricTimeseriesResponse{
		Metric: metricType,
		Unit:   unit,
		Step:   tr.Step.String(),
		Series: seriesList,
	}

	if s.cache != nil {
		s.cache.SetTimeseries(projectID, qHash, resp, 10*time.Second)
	}

	return resp, nil
}

func (s *metricsService) determineSeriesKey(groupBy, endpointKey string, status int) string {
	if groupBy == domain.GroupByEndpoint {
		return endpointKey
	}
	if groupBy == domain.GroupByStatusClass {
		if status >= 200 && status < 300 {
			return "2xx"
		} else if status >= 300 && status < 400 {
			return "3xx"
		} else if status >= 400 && status < 500 {
			return "4xx"
		} else if status >= 500 && status < 600 {
			return "5xx"
		}
		return "other"
	}
	return "all"
}

func (s *metricsService) determineSeriesKeyFromRollup(groupBy, endpointKey string, statusCounts domain.JSONMap) string {
	if groupBy == domain.GroupByEndpoint {
		return endpointKey
	}
	if groupBy == domain.GroupByStatusClass {
		// Pick dominant class in rollup
		var bestClass string
		var maxCount int64
		for k, v := range statusCounts {
			st, _ := strconv.Atoi(k)
			class := "other"
			if st >= 200 && st < 300 {
				class = "2xx"
			} else if st >= 300 && st < 400 {
				class = "3xx"
			} else if st >= 400 && st < 500 {
				class = "4xx"
			} else if st >= 500 && st < 600 {
				class = "5xx"
			}

			var cnt int64
			switch val := v.(type) {
			case int64:
				cnt = val
			case float64:
				cnt = int64(val)
			}
			if cnt > maxCount {
				maxCount = cnt
				bestClass = class
			}
		}
		if bestClass != "" {
			return bestClass
		}
		return "2xx"
	}
	return "all"
}

// GetEndpointsMetrics provides table-driven metrics with sorting and health status for endpoints.
func (s *metricsService) GetEndpointsMetrics(ctx context.Context, projectID string, query EndpointsMetricsQuery) ([]*domain.EndpointMetricItem, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	tr, err := ParseTimeRange(s.clock, query.Range, query.From, query.To, "")
	if err != nil {
		return nil, err
	}

	endpoints, _, err := s.endpointRepo.List(ctx, projectID, domain.ListEndpointsQuery{
		Q:     query.Search,
		Limit: 100,
	})
	if err != nil {
		return nil, err
	}

	results := make([]*domain.EndpointMetricItem, 0, len(endpoints))
	for _, ep := range endpoints {
		epKey := fmt.Sprintf("%s %s", ep.Method, ep.PathTemplate)
		summary, err := s.aggregateWindow(ctx, projectID, epKey, tr.Start, tr.End, tr.Duration)
		if err != nil {
			continue
		}

		health := ClassifyEndpointHealth(summary.Requests, summary.P95, summary.ErrorRate)

		results = append(results, &domain.EndpointMetricItem{
			EndpointID:   ep.ID,
			Method:       ep.Method,
			PathTemplate: ep.PathTemplate,
			Service:      ep.Service,
			Requests:     summary.Requests,
			RPS:          summary.RPS,
			P50:          summary.P50,
			P95:          summary.P95,
			P99:          summary.P99,
			ErrorRate:    summary.ErrorRate,
			Health:       health,
		})
	}

	// Sort results
	sortParam := strings.ToLower(strings.TrimSpace(query.Sort))
	switch sortParam {
	case "-p95":
		sort.Slice(results, func(i, j int) bool { return results[i].P95 > results[j].P95 })
	case "-error_rate":
		sort.Slice(results, func(i, j int) bool { return results[i].ErrorRate > results[j].ErrorRate })
	default: // -requests
		sort.Slice(results, func(i, j int) bool { return results[i].Requests > results[j].Requests })
	}

	if query.Limit > 0 && len(results) > query.Limit {
		results = results[:query.Limit]
	}

	return results, nil
}

// GetStatusCodes breaks down observed responses by HTTP code and status class.
func (s *metricsService) GetStatusCodes(ctx context.Context, projectID string, query MetricsQuery) (*domain.StatusCodesResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	tr, err := ParseTimeRange(s.clock, query.Range, query.From, query.To, "")
	if err != nil {
		return nil, err
	}

	qHash := hashQuery("status_codes", query.Range, query.From, query.To, query.EndpointID)
	if s.cache != nil {
		if cached, ok := s.cache.GetStatusCodes(projectID, qHash); ok {
			return cached, nil
		}
	}

	endpointKey, err := s.resolveEndpointKey(ctx, projectID, query.EndpointID)
	if err != nil {
		return nil, err
	}

	codeCounts := make(map[int]int64)

	if tr.Duration <= 15*time.Minute {
		events, err := s.store.QueryEvents(ctx, projectID, tr.Start, tr.End, 10000)
		if err != nil {
			return nil, err
		}
		for _, e := range events {
			if endpointKey != "" && fmt.Sprintf("%s %s", e.Method, e.Route) != endpointKey {
				continue
			}
			codeCounts[e.Status]++
		}
	} else if tr.Duration <= 24*time.Hour {
		rollups, err := s.store.QueryRollups1m(ctx, projectID, endpointKey, tr.Start, tr.End)
		if err != nil {
			return nil, err
		}
		for _, r := range rollups {
			for k, v := range r.StatusCounts {
				st, _ := strconv.Atoi(k)
				switch val := v.(type) {
				case int64:
					codeCounts[st] += val
				case float64:
					codeCounts[st] += int64(val)
				}
			}
		}
	} else {
		rollups, err := s.store.QueryRollups1h(ctx, projectID, endpointKey, tr.Start, tr.End)
		if err != nil {
			return nil, err
		}
		for _, r := range rollups {
			for k, v := range r.StatusCounts {
				st, _ := strconv.Atoi(k)
				switch val := v.(type) {
				case int64:
					codeCounts[st] += val
				case float64:
					codeCounts[st] += int64(val)
				}
			}
		}
	}

	classes := map[string]int64{
		"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0,
	}
	codesList := make([]domain.StatusCodeCount, 0, len(codeCounts))

	for code, cnt := range codeCounts {
		codesList = append(codesList, domain.StatusCodeCount{Status: code, Count: cnt})
		if code >= 200 && code < 300 {
			classes["2xx"] += cnt
		} else if code >= 300 && code < 400 {
			classes["3xx"] += cnt
		} else if code >= 400 && code < 500 {
			classes["4xx"] += cnt
		} else if code >= 500 && code < 600 {
			classes["5xx"] += cnt
		}
	}

	sort.Slice(codesList, func(i, j int) bool {
		return codesList[i].Count > codesList[j].Count
	})

	resp := &domain.StatusCodesResponse{
		Classes: classes,
		Codes:   codesList,
	}

	if s.cache != nil {
		s.cache.SetStatusCodes(projectID, qHash, resp, 10*time.Second)
	}

	return resp, nil
}

// GetHostsMetrics returns host infrastructure metrics, or connected=false if no agents reported.
func (s *metricsService) GetHostsMetrics(ctx context.Context, projectID string, query HostsMetricsQuery) (*domain.HostsMetricsResponse, error) {
	if _, err := s.projectRepo.FindOnlyByID(ctx, projectID); err != nil {
		return nil, domain.NewProjectNotFoundError()
	}

	return &domain.HostsMetricsResponse{
		Connected: false,
		Host:      query.Host,
		Metric:    query.Metric,
		Series:    []domain.TimeseriesSeries{},
	}, nil
}

func (s *metricsService) resolveEndpointKey(ctx context.Context, projectID, endpointID string) (string, error) {
	if endpointID == "" {
		return "", nil
	}
	ep, err := s.endpointRepo.FindByID(ctx, projectID, endpointID)
	if err != nil {
		return "", domain.NewEndpointNotFoundError()
	}
	return fmt.Sprintf("%s %s", ep.Method, ep.PathTemplate), nil
}
