package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/Prince-695/strim/backend/internal/sse"
	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

// LoadTestHandler exposes HTTP and SSE endpoints for managing and watching load tests.
type LoadTestHandler struct {
	svc    service.LoadTestService
	sseHub *sse.Hub
	logger *slog.Logger
}

// NewLoadTestHandler instantiates a LoadTestHandler.
func NewLoadTestHandler(svc service.LoadTestService, sseHub *sse.Hub, logger *slog.Logger) *LoadTestHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &LoadTestHandler{
		svc:    svc,
		sseHub: sseHub,
		logger: logger,
	}
}

// CreateLoadTest queues or drafts a new load test run.
// @Summary Create a load test
// @Tags LoadTests
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param Idempotency-Key header string false "Idempotency key"
// @Param request body domain.CreateLoadTestRequest true "Load test configuration"
// @Success 201 {object} domain.Response{data=domain.LoadTestResponse}
// @Failure 400 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests [post]
func (h *LoadTestHandler) CreateLoadTest(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	userID := middleware.GetUserID(c)
	idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))

	var req domain.CreateLoadTestRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	res, err := h.svc.CreateLoadTest(c.Context(), orgID, projectID, userID, req, idempotencyKey)
	if err != nil {
		return err
	}

	msg := "Load test queued"
	if !req.StartNow {
		msg = "Load test draft created"
	}

	return domain.SendSuccess(c, fiber.StatusCreated, res, nil, msg)
}

// ListLoadTests returns paginated load test history for a project.
// @Summary List load tests
// @Tags LoadTests
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param status query string false "Filter by status (draft, queued, running, completed, stopped, failed)"
// @Param profile query string false "Filter by profile (sustained, ramp, spike, step)"
// @Param sort query string false "Sort order (-created_at, created_at)" default(-created_at)
// @Param limit query int false "Pagination limit" default(50)
// @Success 200 {object} domain.Response{data=[]domain.LoadTestResponse}
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests [get]
func (h *LoadTestHandler) ListLoadTests(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	query := repository.ListLoadTestsQuery{
		Status:  domain.LoadTestStatus(c.Query("status")),
		Profile: domain.LoadTestProfile(c.Query("profile")),
		Sort:    c.Query("sort"),
		Limit:   limit,
		Cursor:  c.Query("cursor"),
	}

	tests, total, err := h.svc.ListLoadTests(c.Context(), orgID, projectID, query)
	if err != nil {
		return err
	}

	totalInt := int(total)
	meta := &domain.PageMeta{
		Limit:   limit,
		Total:   &totalInt,
		HasMore: int64(len(tests)) < total,
	}

	return domain.SendSuccess(c, fiber.StatusOK, tests, meta, "Load tests retrieved")
}

// GetLoadTest returns details of a single load test run.
// @Summary Get load test details
// @Tags LoadTests
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Success 200 {object} domain.Response{data=domain.LoadTestDetailResponse}
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID} [get]
func (h *LoadTestHandler) GetLoadTest(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	testID := strings.TrimSpace(c.Params("testID"))

	detail, err := h.svc.GetLoadTest(c.Context(), orgID, projectID, testID)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, detail, "Load test retrieved")
}

// StopLoadTest cancels and drains an active load test.
// @Summary Stop a running load test
// @Tags LoadTests
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Success 202 {object} domain.Response{data=domain.LoadTestResponse}
// @Failure 404 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/stop [post]
func (h *LoadTestHandler) StopLoadTest(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	testID := strings.TrimSpace(c.Params("testID"))

	stopped, err := h.svc.StopLoadTest(c.Context(), orgID, projectID, testID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusAccepted, stopped, nil, "Load test stop requested")
}

// RerunLoadTest clones a previous test's configuration and queues a new run.
// @Summary Rerun a load test
// @Tags LoadTests
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Success 201 {object} domain.Response{data=domain.LoadTestResponse}
// @Failure 404 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Failure 422 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/rerun [post]
func (h *LoadTestHandler) RerunLoadTest(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	testID := strings.TrimSpace(c.Params("testID"))
	userID := middleware.GetUserID(c)

	rerun, err := h.svc.RerunLoadTest(c.Context(), orgID, projectID, testID, userID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusCreated, rerun, nil, "Load test queued")
}

// DeleteLoadTest deletes a completed or stopped load test and its results.
// @Summary Delete a load test
// @Tags LoadTests
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Success 200 {object} domain.Response
// @Failure 404 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID} [delete]
func (h *LoadTestHandler) DeleteLoadTest(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	testID := strings.TrimSpace(c.Params("testID"))

	if err := h.svc.DeleteLoadTest(c.Context(), orgID, projectID, testID); err != nil {
		return err
	}

	return domain.SendOKMsg(c, nil, "Load test deleted")
}

// GetResults returns the comprehensive breakdown, latency distribution, and flags for a finished test.
// @Summary Get load test results
// @Tags LoadTests
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Success 200 {object} domain.Response{data=domain.LoadTestResultsResponse}
// @Failure 404 {object} domain.Response
// @Failure 409 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/results [get]
func (h *LoadTestHandler) GetResults(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	testID := strings.TrimSpace(c.Params("testID"))

	results, err := h.svc.GetResults(c.Context(), orgID, projectID, testID)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, results, "Load test results retrieved")
}

// GetTimeseries returns execution metrics grouped by second steps.
// @Summary Get load test timeseries
// @Tags LoadTests
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Param step query string false "Timeseries step (1s, 5s, 10s)" default(1s)
// @Success 200 {object} domain.Response{data=domain.LoadTestTimeseriesResponse}
// @Failure 404 {object} domain.Response
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/timeseries [get]
func (h *LoadTestHandler) GetTimeseries(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	testID := strings.TrimSpace(c.Params("testID"))
	step := c.Query("step", "1s")

	ts, err := h.svc.GetTimeseries(c.Context(), orgID, projectID, testID, step)
	if err != nil {
		return err
	}

	return domain.SendOKMsg(c, ts, "Load test timeseries retrieved")
}

// StreamProgress streams real-time execution progress over Server-Sent Events.
// @Summary Stream load test progress (SSE)
// @Tags LoadTests
// @Produce text/event-stream
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/progress [get]
func (h *LoadTestHandler) StreamProgress(c *fiber.Ctx) error {
	orgID := strings.TrimSpace(c.Params("orgID"))
	projectID := strings.TrimSpace(c.Params("projectID"))
	testID := strings.TrimSpace(c.Params("testID"))
	userID := middleware.GetUserID(c)

	// Verify test exists and belongs to tenant
	test, err := h.svc.GetLoadTest(c.Context(), orgID, projectID, testID)
	if err != nil {
		return err
	}

	client := sse.NewClient(context.Background(), userID, projectID)
	topic := fmt.Sprintf("loadtest:%s", testID)

	if err := h.sseHub.Subscribe(topic, client); err != nil {
		if errors.Is(err, sse.ErrMaxStreamsExceeded) {
			return domain.NewAppError(fiber.StatusTooManyRequests, domain.ErrCodeRateLimited, "Maximum concurrent SSE streams reached (limit: 5)", nil)
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

		// Initial snapshot
		cfgSummary := map[string]interface{}{
			"profile":   test.Profile,
			"model":     test.Model,
			"peak_rate": test.Config.PeakRate,
		}
		if err := sendEvent("snapshot", domain.SSEProgressSnapshotData{
			Status:         test.Status,
			ElapsedSeconds: 0,
			ConfigSummary:  cfgSummary,
		}); err != nil {
			return
		}

		// If test is already finished, send status, end, and close
		if test.Status == domain.LoadTestStatusCompleted || test.Status == domain.LoadTestStatusStopped || test.Status == domain.LoadTestStatusFailed {
			_ = sendEvent("status", domain.SSEProgressStatusData{Status: test.Status})
			_ = sendEvent("end", domain.SSEProgressEndData{Reason: string(test.Status)})
			return
		}

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

				if event.Event == "end" {
					return
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
