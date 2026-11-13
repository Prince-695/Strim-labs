package domain

import (
	"time"
)

// RecomputeCapacityRequest specifies updated thresholds to re-analyze an existing test run.
type RecomputeCapacityRequest struct {
	Thresholds *CapacityThresholds `json:"thresholds,omitempty"`
	Save       bool                `json:"save"`
}

// CapacityReportResponse serializes a capacity report for API clients.
type CapacityReportResponse struct {
	ID               string             `json:"id"`
	LoadTestID       string             `json:"load_test_id"`
	ProjectID        string             `json:"project_id"`
	SustainableRPS   float64            `json:"sustainable_rps"`
	BreakingPointRPS *float64           `json:"breaking_point_rps"`
	BreakingReason   *string            `json:"breaking_reason,omitempty"`
	BaselineP95Ms    float64            `json:"baseline_p95_ms"`
	Confidence       string             `json:"confidence"`
	Note             string             `json:"note"`
	Thresholds       CapacityThresholds `json:"thresholds"`
	Windows          []CapacityWindow   `json:"windows"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
}

// CompareLoadTestsRequest specifies 2 to 5 test IDs to compare against a baseline.
type CompareLoadTestsRequest struct {
	TestIDs    []string `json:"test_ids"`
	BaselineID string   `json:"baseline_id,omitempty"`
}

// CompareTestSummary provides high-level summary metrics for a compared test.
type CompareTestSummary struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	AvgRPS         float64  `json:"avg_rps"`
	PeakRPS        float64  `json:"peak_rps"`
	P95MS          float64  `json:"p95_ms"`
	ErrorRate      float64  `json:"error_rate"`
	SustainableRPS *float64 `json:"sustainable_rps,omitempty"`
}

// CompareTestDelta specifies percentage and absolute variance relative to the baseline run.
type CompareTestDelta struct {
	TestID       string  `json:"test_id"`
	AvgRPSPct    float64 `json:"avg_rps_pct"`
	PeakRPSPct   float64 `json:"peak_rps_pct"`
	P95Pct       float64 `json:"p95_pct"`
	ErrorRatePct float64 `json:"error_rate_pct"`
	Verdict      string  `json:"verdict"` // improved, regressed, unchanged
}

// OverlayPoint represents a single data point on the comparison time-series chart.
type OverlayPoint struct {
	T           int     `json:"t"`
	OfferedRPS  float64 `json:"offered_rps"`
	AchievedRPS float64 `json:"achieved_rps"`
	P95         float64 `json:"p95"`
	Errors      int     `json:"errors"`
}

// OverlaySeries represents the resampled time-series points for one test.
type OverlaySeries struct {
	TestID string         `json:"test_id"`
	Name   string         `json:"name"`
	Points []OverlayPoint `json:"points"`
}

// CompareOverlay aggregates the synchronized visual curves for all compared tests.
type CompareOverlay struct {
	Step   string          `json:"step"`
	Series []OverlaySeries `json:"series"`
}

// CompareLoadTestsResponse contains the full comparison data payload.
type CompareLoadTestsResponse struct {
	BaselineID string               `json:"baseline_id"`
	Tests      []CompareTestSummary `json:"tests"`
	Deltas     []CompareTestDelta   `json:"deltas"`
	Overlay    CompareOverlay       `json:"overlay"`
}

// ToResponse converts a CapacityReport domain entity into an API response DTO.
func (cr *CapacityReport) ToResponse() *CapacityReportResponse {
	if cr == nil {
		return nil
	}
	return &CapacityReportResponse{
		ID:               cr.ID,
		LoadTestID:       cr.LoadTestID,
		ProjectID:        cr.ProjectID,
		SustainableRPS:   cr.SustainableRPS,
		BreakingPointRPS: cr.BreakingPointRPS,
		BreakingReason:   cr.BreakingReason,
		BaselineP95Ms:    cr.BaselineP95Ms,
		Confidence:       cr.Confidence,
		Note:             cr.Note,
		Thresholds:       cr.Thresholds,
		Windows:          cr.Windows,
		CreatedAt:        cr.CreatedAt,
		UpdatedAt:        cr.UpdatedAt,
	}
}
