package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/Prince-695/strim/backend/internal/sse"
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

// MetricsHandler handles HTTP endpoints for observability metrics and real-time SSE streaming.
type MetricsHandler struct {
	metricsSvc service.MetricsService
	sseHub     *sse.Hub
	logger     *slog.Logger
}

// NewMetricsHandler instantiates a MetricsHandler.
func NewMetricsHandler(metricsSvc service.MetricsService, sseHub *sse.Hub, logger *slog.Logger) *MetricsHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &MetricsHandler{
		metricsSvc: metricsSvc,
		sseHub:     sseHub,
		logger:     logger,
	}
}

// GetOverview computes KPI metrics for the current window and previous comparative window.
// @Summary Get project metrics overview
// @Description Returns aggregate throughput (RPS), total requests, latency percentiles (p50, p90, p95, p99), error rate, and previous period comparisons for trend arrows
// @Tags Metrics
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param range query string false "Relative range (15m, 1h, 6h, 24h, 7d, 30d)" default(1h)
// @Param from query string false "Explicit start RFC3339 timestamp"
// @Param to query string false "Explicit end RFC3339 timestamp"
// @Param endpoint_id query string false "Optional Endpoint UUID filter"
// @Success 200 {object} domain.Response{data=domain.MetricsOverviewResponse}
// @Failure 400 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/metrics/overview [get]
func (h *MetricsHandler) GetOverview(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	query := service.MetricsQuery{
		Range:      c.Query("range"),
		From:       c.Query("from"),
		To:         c.Query("to"),
		EndpointID: c.Query("endpoint_id"),
	}

	resp, err := h.metricsSvc.GetOverview(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// GetTimeseries retrieves time-series points for charts with null values for missing intervals.
// @Summary Get metrics time-series
// @Description Returns granular time-series data for a chosen metric (rps, requests, p50, p95, p99, avg, error_rate, success_rate, timeouts) with null for missing intervals
// @Tags Metrics
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param metric query string false "Metric type (rps, requests, p50, p95, p99, avg, error_rate, success_rate, timeouts)" default(rps)
// @Param range query string false "Relative range (15m, 1h, 6h, 24h, 7d, 30d)" default(1h)
// @Param from query string false "Explicit start RFC3339 timestamp"
// @Param to query string false "Explicit end RFC3339 timestamp"
// @Param step query string false "Time step interval (10s, 1m, 5m, 1h)"
// @Param endpoint_id query string false "Optional Endpoint UUID filter"
// @Param group_by query string false "Group by dimension (endpoint, status_class)"
// @Success 200 {object} domain.Response{data=domain.MetricTimeseriesResponse}
// @Failure 400 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/metrics/timeseries [get]
func (h *MetricsHandler) GetTimeseries(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	query := service.TimeseriesQuery{
		MetricsQuery: service.MetricsQuery{
			Range:      c.Query("range"),
			From:       c.Query("from"),
			To:         c.Query("to"),
			EndpointID: c.Query("endpoint_id"),
		},
		Metric:  c.Query("metric"),
		Step:    c.Query("step"),
		GroupBy: c.Query("group_by"),
	}

	resp, err := h.metricsSvc.GetTimeseries(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// GetEndpointsMetrics provides table-driven metrics with sorting and health classification for endpoints.
// @Summary List endpoint metrics
// @Description Returns list of endpoints with throughput, p50/p95/p99 latency, error rate, and health status (healthy, degraded, failing, no_data)
// @Tags Metrics
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param range query string false "Relative range (15m, 1h, 6h, 24h, 7d, 30d)" default(1h)
// @Param from query string false "Explicit start RFC3339 timestamp"
// @Param to query string false "Explicit end RFC3339 timestamp"
// @Param sort query string false "Sort order (-requests, -p95, -error_rate)" default(-requests)
// @Param limit query int false "Maximum number of items" default(50)
// @Param cursor query string false "Cursor for pagination"
// @Param q query string false "Search pattern"
// @Success 200 {object} domain.Response{data=[]domain.EndpointMetricItem}
// @Failure 400 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/metrics/endpoints [get]
func (h *MetricsHandler) GetEndpointsMetrics(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	limit := c.QueryInt("limit", 50)
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := service.EndpointsMetricsQuery{
		MetricsQuery: service.MetricsQuery{
			Range: c.Query("range"),
			From:  c.Query("from"),
			To:    c.Query("to"),
		},
		Sort:   c.Query("sort"),
		Limit:  limit,
		Cursor: c.Query("cursor"),
		Search: c.Query("q"),
	}

	resp, err := h.metricsSvc.GetEndpointsMetrics(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// GetStatusCodes breaks down observed responses by HTTP code and status class.
// @Summary Get status code distribution
// @Description Returns counts grouped by class (2xx, 3xx, 4xx, 5xx) and individual response codes
// @Tags Metrics
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param range query string false "Relative range (15m, 1h, 6h, 24h, 7d, 30d)" default(1h)
// @Param from query string false "Explicit start RFC3339 timestamp"
// @Param to query string false "Explicit end RFC3339 timestamp"
// @Param endpoint_id query string false "Optional Endpoint UUID filter"
// @Success 200 {object} domain.Response{data=domain.StatusCodesResponse}
// @Failure 400 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/metrics/status-codes [get]
func (h *MetricsHandler) GetStatusCodes(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	query := service.MetricsQuery{
		Range:      c.Query("range"),
		From:       c.Query("from"),
		To:         c.Query("to"),
		EndpointID: c.Query("endpoint_id"),
	}

	resp, err := h.metricsSvc.GetStatusCodes(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// GetHostsMetrics returns host infrastructure metrics, or connected=false if no agents reported.
// @Summary Get host infrastructure metrics
// @Description Returns CPU, memory, network, and disk metrics for host infrastructure or empty state when no agent is reporting
// @Tags Metrics
// @Security BearerAuth
// @Produce json
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param range query string false "Relative range (15m, 1h, 6h, 24h, 7d, 30d)" default(1h)
// @Param host query string false "Host identifier"
// @Param metric query string false "Metric type (cpu, memory, network, disk)"
// @Success 200 {object} domain.Response{data=domain.HostsMetricsResponse}
// @Failure 400 {object} domain.Response
// @Failure 401 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/metrics/hosts [get]
func (h *MetricsHandler) GetHostsMetrics(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))

	query := service.HostsMetricsQuery{
		MetricsQuery: service.MetricsQuery{
			Range: c.Query("range"),
		},
		Host:   c.Query("host"),
		Metric: c.Query("metric"),
	}

	resp, err := h.metricsSvc.GetHostsMetrics(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendOK(c, resp, nil)
}

// StreamMetrics opens a real-time Server-Sent Events stream pushing overview and endpoint health updates.
// @Summary Stream real-time project metrics (SSE)
// @Description Opens an SSE stream pushing periodic overview data every 2-10 seconds, endpoint health updates, and a ': ping' heartbeat every 15 seconds
// @Tags Metrics
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param endpoint_id query string false "Optional Endpoint UUID filter"
// @Param interval query string false "Push interval (2s, 5s, 10s)" default(5s)
// @Router /v1/organizations/{orgID}/projects/{projectID}/metrics/stream [get]
func (h *MetricsHandler) StreamMetrics(c *fiber.Ctx) error {
	projectID := strings.TrimSpace(c.Params("projectID"))
	userID := middleware.GetUserID(c)
	endpointID := strings.TrimSpace(c.Query("endpoint_id"))

	// Parse stream interval
	interval := 5 * time.Second
	switch strings.ToLower(strings.TrimSpace(c.Query("interval"))) {
	case "2s":
		interval = 2 * time.Second
	case "10s":
		interval = 10 * time.Second
	}

	client := sse.NewClient(context.Background(), userID, projectID)
	topic := sse.FormatTopic(projectID, "metrics")

	if err := h.sseHub.Subscribe(topic, client); err != nil {
		if errors.Is(err, sse.ErrMaxStreamsExceeded) {
			return domain.NewAppError(fiber.StatusTooManyRequests, "RATE_LIMITED", "Maximum concurrent SSE streams reached (limit: 5)", nil)
		}
		return err
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		defer func() {
			h.sseHub.Unsubscribe(topic, client)
			client.Close()
		}()

		var eventIDSeq int64

		sendEvent := func(eventName string, data interface{}) error {
			id := atomic.AddInt64(&eventIDSeq, 1)
			dataBytes, err := json.Marshal(data)
			if err != nil {
				return err
			}

			if _, err := fmt.Fprintf(w, "event: %s\nid: %d\ndata: %s\n\n", eventName, id, string(dataBytes)); err != nil {
				return err
			}
			return w.Flush()
		}

		sendPing := func() error {
			if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
				return err
			}
			return w.Flush()
		}

		// Send initial snapshot overview immediately upon connecting
		if overview, err := h.metricsSvc.GetOverview(client.Context(), projectID, service.MetricsQuery{
			Range:      "15m",
			EndpointID: endpointID,
		}); err == nil && overview != nil {
			if err := sendEvent("overview", domain.SSEOverviewData{
				TS:                   time.Now().UTC(),
				RPS:                  overview.Current.RPS,
				P95:                  overview.Current.P95,
				P99:                  overview.Current.P99,
				ErrorRate:            overview.Current.ErrorRate,
				RequestsLastInterval: overview.Current.Requests,
			}); err != nil {
				return
			}
		}

		pushTicker := time.NewTicker(interval)
		defer pushTicker.Stop()

		heartbeatTicker := time.NewTicker(15 * time.Second)
		defer heartbeatTicker.Stop()

		for {
			select {
			case <-client.Context().Done():
				return

			case <-client.Done:
				return

			case event, ok := <-client.Send:
				if !ok {
					return
				}
				id := atomic.AddInt64(&eventIDSeq, 1)
				if _, err := fmt.Fprintf(w, "event: %s\nid: %d\ndata: %s\n\n", event.Event, id, string(event.Data)); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}

			case <-pushTicker.C:
				overview, err := h.metricsSvc.GetOverview(client.Context(), projectID, service.MetricsQuery{
					Range:      "15m",
					EndpointID: endpointID,
				})
				if err == nil && overview != nil {
					if err := sendEvent("overview", domain.SSEOverviewData{
						TS:                   time.Now().UTC(),
						RPS:                  overview.Current.RPS,
						P95:                  overview.Current.P95,
						P99:                  overview.Current.P99,
						ErrorRate:            overview.Current.ErrorRate,
						RequestsLastInterval: overview.Current.Requests,
					}); err != nil {
						return
					}
				}

			case <-heartbeatTicker.C:
				if err := sendPing(); err != nil {
					return
				}
			}
		}
	}))

	return nil
}
