package handlers

import (
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// DiagnosticsHandler handles HTTP requests for performance diagnostics and root cause analysis.
type DiagnosticsHandler struct {
	service service.DiagnosticsService
	logger  *slog.Logger
}

// NewDiagnosticsHandler creates a new DiagnosticsHandler.
func NewDiagnosticsHandler(svc service.DiagnosticsService, logger *slog.Logger) *DiagnosticsHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &DiagnosticsHandler{
		service: svc,
		logger:  logger,
	}
}

var validTimeRanges = map[string]bool{
	"15m":    true,
	"1h":     true,
	"6h":     true,
	"24h":    true,
	"7d":     true,
	"30d":    true,
	"custom": true,
}

// GetSlowEndpoints godoc
// @Summary Rank slowest endpoints by volume-weighted impact score
// @Description Returns endpoints ranked by volume-weighted impact score (P95 latency * request count) within a time window.
// @Tags Diagnostics
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param range query string false "Time range window (15m, 1h, 6h, 24h, 7d, 30d, custom)" default(1h)
// @Param limit query int false "Max endpoints to return (1-50)" default(10)
// @Param min_requests query int false "Minimum requests threshold" default(10)
// @Param start query string false "Custom start timestamp (RFC3339)"
// @Param end query string false "Custom end timestamp (RFC3339)"
// @Success 200 {object} domain.Response{data=domain.SlowEndpointsResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/diagnostics/slow-endpoints [get]
func (h *DiagnosticsHandler) GetSlowEndpoints(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	rangeParam := c.Query("range", "1h")
	if !validTimeRanges[strings.ToLower(rangeParam)] {
		return domain.NewValidationError("range must be one of: 15m, 1h, 6h, 24h, 7d, 30d, custom", nil)
	}

	limitParam := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		val, err := strconv.Atoi(limitStr)
		if err != nil || val < 1 || val > 50 {
			return domain.NewValidationError("limit must be between 1 and 50", nil)
		}
		limitParam = val
	}

	minReqsParam, _ := strconv.Atoi(c.Query("min_requests", "10"))
	if minReqsParam < 0 {
		minReqsParam = 0
	}

	var startPtr, endPtr *time.Time
	startStr := strings.TrimSpace(c.Query("start"))
	endStr := strings.TrimSpace(c.Query("end"))
	if startStr != "" && endStr != "" {
		st, err := time.Parse(time.RFC3339, startStr)
		if err != nil {
			return domain.NewValidationError("invalid start timestamp, must be RFC3339", nil)
		}
		et, err := time.Parse(time.RFC3339, endStr)
		if err != nil {
			return domain.NewValidationError("invalid end timestamp, must be RFC3339", nil)
		}
		if !et.After(st) {
			return domain.NewValidationError("end timestamp must be after start timestamp", nil)
		}
		startPtr = &st
		endPtr = &et
	}

	query := domain.SlowEndpointsQuery{
		Range:       rangeParam,
		Start:       startPtr,
		End:         endPtr,
		Limit:       limitParam,
		MinRequests: minReqsParam,
	}

	resp, err := h.service.GetSlowEndpoints(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Slow endpoints retrieved successfully")
}

// GetRegressions godoc
// @Summary Detect performance regressions
// @Description Identifies endpoints with significant latency or error rate degradation relative to prior periods or a load test baseline.
// @Tags Diagnostics
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param range query string false "Time range window (15m, 1h, 6h, 24h, 7d, 30d)" default(1h)
// @Param baseline query string false "Baseline to compare against ('previous' or 'test:{id}')" default(previous)
// @Param threshold_pct query number false "Minimum percentage degradation to flag as regression" default(10.0)
// @Success 200 {object} domain.Response{data=domain.RegressionsResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project or baseline not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/diagnostics/regressions [get]
func (h *DiagnosticsHandler) GetRegressions(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	rangeParam := c.Query("range", "1h")
	if !validTimeRanges[strings.ToLower(rangeParam)] {
		return domain.NewValidationError("range must be one of: 15m, 1h, 6h, 24h, 7d, 30d", nil)
	}

	baselineParam := c.Query("baseline", "previous")
	threshParam, _ := strconv.ParseFloat(c.Query("threshold_pct", "10.0"), 64)

	query := domain.RegressionsQuery{
		Range:        rangeParam,
		Baseline:     baselineParam,
		ThresholdPct: threshParam,
	}

	resp, err := h.service.GetRegressions(c.Context(), projectID, query)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Regressions evaluated successfully")
}

// GetBottlenecks godoc
// @Summary Get architectural bottleneck hints
// @Description Produces diagnostic correlation hints identifying throughput saturation walls, tail latency dispersion, error surges, and execution time sinks.
// @Tags Diagnostics
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param range query string false "Time range window (15m, 1h, 6h, 24h, 7d, 30d)" default(1h)
// @Success 200 {object} domain.Response{data=domain.BottlenecksResponse}
// @Failure 400 {object} domain.Response "Bad Request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Project not found"
// @Router /v1/organizations/{orgID}/projects/{projectID}/diagnostics/bottlenecks [get]
func (h *DiagnosticsHandler) GetBottlenecks(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	rangeParam := c.Query("range", "1h")
	if !validTimeRanges[strings.ToLower(rangeParam)] {
		return domain.NewValidationError("range must be one of: 15m, 1h, 6h, 24h, 7d, 30d", nil)
	}

	resp, err := h.service.GetBottlenecks(c.Context(), projectID, rangeParam)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Bottleneck diagnostic hints generated successfully")
}
