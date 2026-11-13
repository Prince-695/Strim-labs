package handlers

import (
	"log/slog"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
)

// CapacityHandler handles HTTP requests for capacity analysis and run comparisons.
type CapacityHandler struct {
	service service.CapacityService
	logger  *slog.Logger
}

// NewCapacityHandler creates a new CapacityHandler.
func NewCapacityHandler(svc service.CapacityService, logger *slog.Logger) *CapacityHandler {
	if logger == nil {
		logger = slog.Default()
	}
	return &CapacityHandler{
		service: svc,
		logger:  logger,
	}
}

// GetCapacityReport godoc
// @Summary Get capacity analysis report
// @Description Returns the analyzed capacity limit, sustainable RPS, breaking point, and per-window health metrics for a finished load test.
// @Tags Capacity
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Success 200 {object} domain.Response{data=domain.CapacityReportResponse}
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Load test not found"
// @Failure 409 {object} domain.Response "Test not finished"
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/capacity [get]
func (h *CapacityHandler) GetCapacityReport(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	testID := c.Params("testID")

	report, err := h.service.GetCapacityReport(c.Context(), projectID, testID)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, report.ToResponse(), nil, "Capacity report retrieved successfully")
}

// RecomputeCapacity godoc
// @Summary Recompute capacity with custom thresholds
// @Description Recomputes capacity and breaking point metrics using custom thresholds on historical data without re-running the test.
// @Tags Capacity
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param testID path string true "Load Test ID"
// @Param body body domain.RecomputeCapacityRequest true "Updated capacity thresholds and save option"
// @Success 200 {object} domain.Response{data=domain.CapacityReportResponse}
// @Failure 400 {object} domain.Response "Invalid request"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Load test not found"
// @Failure 409 {object} domain.Response "Test not finished"
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/{testID}/capacity/recompute [post]
func (h *CapacityHandler) RecomputeCapacity(c *fiber.Ctx) error {
	projectID := c.Params("projectID")
	testID := c.Params("testID")

	var req domain.RecomputeCapacityRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	report, err := h.service.RecomputeCapacity(c.Context(), projectID, testID, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, report.ToResponse(), nil, "Capacity recomputed successfully")
}

// CompareLoadTests godoc
// @Summary Compare multiple load test runs
// @Description Compares 2 to 5 finished load tests within the project, calculating percentage deltas, regression verdicts, and synchronized time-series overlays.
// @Tags Capacity
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param orgID path string true "Organization ID"
// @Param projectID path string true "Project ID"
// @Param body body domain.CompareLoadTestsRequest true "Test IDs and optional baseline ID"
// @Success 200 {object} domain.Response{data=domain.CompareLoadTestsResponse}
// @Failure 400 {object} domain.Response "Validation error"
// @Failure 401 {object} domain.Response "Unauthorized"
// @Failure 403 {object} domain.Response "Forbidden"
// @Failure 404 {object} domain.Response "Test not found"
// @Failure 409 {object} domain.Response "Test not finished"
// @Router /v1/organizations/{orgID}/projects/{projectID}/load-tests/compare [post]
func (h *CapacityHandler) CompareLoadTests(c *fiber.Ctx) error {
	projectID := c.Params("projectID")

	var req domain.CompareLoadTestsRequest
	if err := c.BodyParser(&req); err != nil {
		return domain.NewBadRequestError("Malformed JSON request body", err)
	}

	resp, err := h.service.CompareLoadTests(c.Context(), projectID, req)
	if err != nil {
		return err
	}

	return domain.SendSuccess(c, fiber.StatusOK, resp, nil, "Tests compared successfully")
}
