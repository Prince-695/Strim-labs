package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"

	"github.com/Prince-695/strim/backend/internal/analysis"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// CapacityService defines the business operations for capacity analysis and run comparisons.
type CapacityService interface {
	GetCapacityReport(ctx context.Context, projectID, testID string) (*domain.CapacityReport, error)
	RecomputeCapacity(ctx context.Context, projectID, testID string, req domain.RecomputeCapacityRequest) (*domain.CapacityReport, error)
	CompareLoadTests(ctx context.Context, projectID string, req domain.CompareLoadTestsRequest) (*domain.CompareLoadTestsResponse, error)
}

type capacityService struct {
	capacityRepo repository.CapacityRepository
	loadTestRepo repository.LoadTestRepository
}

// NewCapacityService creates a new CapacityService instance.
func NewCapacityService(
	capacityRepo repository.CapacityRepository,
	loadTestRepo repository.LoadTestRepository,
) CapacityService {
	return &capacityService{
		capacityRepo: capacityRepo,
		loadTestRepo: loadTestRepo,
	}
}

// GetCapacityReport fetches the analyzed capacity report for a completed load test.
func (s *capacityService) GetCapacityReport(ctx context.Context, projectID, testID string) (*domain.CapacityReport, error) {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if test == nil || test.ProjectID != projectID {
		return nil, domain.NewNotFoundError("Load test not found")
	}

	if test.Status == domain.LoadTestStatusDraft ||
		test.Status == domain.LoadTestStatusQueued ||
		test.Status == domain.LoadTestStatusRunning {
		return nil, domain.NewConflictError(domain.ErrCodeTestNotFinished, "Load test is still active or queued; capacity report is only available after completion")
	}

	report, err := s.capacityRepo.FindByLoadTestID(ctx, testID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	// If report was not persisted yet (e.g. legacy test), compute on-the-fly and save
	if report == nil {
		tsList, err := s.loadTestRepo.GetTimeseries(ctx, testID, 1)
		if err != nil {
			return nil, domain.NewInternalError(err)
		}
		var thresholds domain.CapacityThresholds
		var cfg domain.LoadTestConfig
		if cfgBytes, err := json.Marshal(test.Config); err == nil {
			_ = json.Unmarshal(cfgBytes, &cfg)
			if cfg.CapacityThresholds != nil {
				thresholds = *cfg.CapacityThresholds
			}
		}

		var flags *domain.LoadTestFlags
		if results, _ := s.loadTestRepo.GetResults(ctx, testID); results != nil && len(results.Flags) > 0 {
			var fl domain.LoadTestFlags
			if fb, err := json.Marshal(results.Flags); err == nil {
				_ = json.Unmarshal(fb, &fl)
				flags = &fl
			}
		}

		report = analysis.AnalyzeCapacity(test, tsList, thresholds, flags)
		_ = s.capacityRepo.Save(ctx, report)
	}

	return report, nil
}

// RecomputeCapacity calculates capacity on-the-fly using user-supplied thresholds.
func (s *capacityService) RecomputeCapacity(ctx context.Context, projectID, testID string, req domain.RecomputeCapacityRequest) (*domain.CapacityReport, error) {
	test, err := s.loadTestRepo.FindByID(ctx, testID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	if test == nil || test.ProjectID != projectID {
		return nil, domain.NewNotFoundError("Load test not found")
	}

	if test.Status == domain.LoadTestStatusDraft ||
		test.Status == domain.LoadTestStatusQueued ||
		test.Status == domain.LoadTestStatusRunning {
		return nil, domain.NewConflictError(domain.ErrCodeTestNotFinished, "Load test is still active or queued; capacity report is only available after completion")
	}

	tsList, err := s.loadTestRepo.GetTimeseries(ctx, testID, 1)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	var thresholds domain.CapacityThresholds
	if req.Thresholds != nil {
		thresholds = *req.Thresholds
	}

	var flags *domain.LoadTestFlags
	if results, _ := s.loadTestRepo.GetResults(ctx, testID); results != nil && len(results.Flags) > 0 {
		var fl domain.LoadTestFlags
		if fb, err := json.Marshal(results.Flags); err == nil {
			_ = json.Unmarshal(fb, &fl)
			flags = &fl
		}
	}

	report := analysis.AnalyzeCapacity(test, tsList, thresholds, flags)

	if req.Save {
		if err := s.capacityRepo.Save(ctx, report); err != nil {
			return nil, domain.NewInternalError(err)
		}
	}

	return report, nil
}

// CompareLoadTests compares 2 to 5 finished tests within a project.
func (s *capacityService) CompareLoadTests(ctx context.Context, projectID string, req domain.CompareLoadTestsRequest) (*domain.CompareLoadTestsResponse, error) {
	if len(req.TestIDs) < 2 || len(req.TestIDs) > 5 {
		return nil, domain.NewValidationError("Comparison requires between 2 and 5 test IDs", nil)
	}

	// Validate no duplicate IDs
	seen := make(map[string]bool)
	for _, id := range req.TestIDs {
		if seen[id] {
			return nil, domain.NewValidationError(fmt.Sprintf("Duplicate test ID '%s' in comparison request", id), nil)
		}
		seen[id] = true
	}

	tests := make([]*domain.LoadTest, len(req.TestIDs))
	for i, id := range req.TestIDs {
		t, err := s.loadTestRepo.FindByID(ctx, id)
		if err != nil {
			return nil, domain.NewInternalError(err)
		}
		if t == nil || t.ProjectID != projectID {
			return nil, domain.NewNotFoundError(fmt.Sprintf("Load test '%s' not found in project", id))
		}
		if t.Status != domain.LoadTestStatusCompleted && t.Status != domain.LoadTestStatusStopped {
			return nil, domain.NewConflictError(domain.ErrCodeTestNotFinished, fmt.Sprintf("Load test '%s' has not finished (status: %s)", id, t.Status))
		}
		tests[i] = t
	}

	// Baseline test determination
	baselineID := req.BaselineID
	if baselineID == "" {
		baselineID = req.TestIDs[0]
	} else if !seen[baselineID] {
		return nil, domain.NewValidationError("Baseline ID must be one of the compared test IDs", nil)
	}

	var testSummaries []domain.CompareTestSummary
	summaryMap := make(map[string]domain.CompareTestSummary)

	// Fetch results & capacity for each test
	for _, t := range tests {
		var avgRPS, peakRPS, p95MS, errRate float64
		results, err := s.loadTestRepo.GetResults(ctx, t.ID)
		if err == nil && results != nil && len(results.Summary) > 0 {
			var sum domain.LoadTestSummary
			if sb, err := json.Marshal(results.Summary); err == nil {
				_ = json.Unmarshal(sb, &sum)
				avgRPS = sum.AvgRPS
				peakRPS = sum.PeakRPS
				p95MS = sum.LatencyMS.P95
				errRate = sum.ErrorRate
			}
		}

		var sustainableRPS *float64
		if capRep, _ := s.capacityRepo.FindByLoadTestID(ctx, t.ID); capRep != nil {
			val := capRep.SustainableRPS
			sustainableRPS = &val
		}

		summary := domain.CompareTestSummary{
			ID:             t.ID,
			Name:           t.Name,
			AvgRPS:         math.Round(avgRPS*10) / 10,
			PeakRPS:        math.Round(peakRPS*10) / 10,
			P95MS:          math.Round(p95MS*10) / 10,
			ErrorRate:      math.Round(errRate*10000) / 10000,
			SustainableRPS: sustainableRPS,
		}
		testSummaries = append(testSummaries, summary)
		summaryMap[t.ID] = summary
	}

	baseSummary := summaryMap[baselineID]

	// Calculate deltas relative to baseline
	var deltas []domain.CompareTestDelta
	for _, t := range tests {
		if t.ID == baselineID {
			continue
		}
		cur := summaryMap[t.ID]

		avgRPSPct := 0.0
		if baseSummary.AvgRPS > 0 {
			avgRPSPct = math.Round(((cur.AvgRPS-baseSummary.AvgRPS)/baseSummary.AvgRPS)*1000) / 10
		}

		peakRPSPct := 0.0
		if baseSummary.PeakRPS > 0 {
			peakRPSPct = math.Round(((cur.PeakRPS-baseSummary.PeakRPS)/baseSummary.PeakRPS)*1000) / 10
		}

		p95Pct := 0.0
		if baseSummary.P95MS > 0 {
			p95Pct = math.Round(((cur.P95MS-baseSummary.P95MS)/baseSummary.P95MS)*1000) / 10
		}

		// Error rate percentage point delta
		errRatePct := math.Round((cur.ErrorRate-baseSummary.ErrorRate)*1000) / 10

		verdict := calculateVerdict(cur, baseSummary, p95Pct, errRatePct)

		deltas = append(deltas, domain.CompareTestDelta{
			TestID:       t.ID,
			AvgRPSPct:    avgRPSPct,
			PeakRPSPct:   peakRPSPct,
			P95Pct:       p95Pct,
			ErrorRatePct: errRatePct,
			Verdict:      verdict,
		})
	}

	// Generate 5s resampled time-series overlay
	var overlaySeries []domain.OverlaySeries
	for _, t := range tests {
		ts5s, err := s.loadTestRepo.GetTimeseries(ctx, t.ID, 5)
		if err != nil {
			continue
		}

		var pts []domain.OverlayPoint
		for _, pt := range ts5s {
			pts = append(pts, domain.OverlayPoint{
				T:           pt.Second,
				OfferedRPS:  math.Round(pt.OfferedRPS*10) / 10,
				AchievedRPS: math.Round(pt.AchievedRPS*10) / 10,
				P95:         math.Round(pt.P95*10) / 10,
				Errors:      pt.Errors,
			})
		}

		overlaySeries = append(overlaySeries, domain.OverlaySeries{
			TestID: t.ID,
			Name:   t.Name,
			Points: pts,
		})
	}

	return &domain.CompareLoadTestsResponse{
		BaselineID: baselineID,
		Tests:      testSummaries,
		Deltas:     deltas,
		Overlay: domain.CompareOverlay{
			Step:   "5s",
			Series: overlaySeries,
		},
	}, nil
}

func calculateVerdict(cur, base domain.CompareTestSummary, p95Pct, errRatePct float64) string {
	// Tolerance threshold is +/- 5%
	// Improved: p95 dropped by > 5% without error rate rising (> 0.5% pt)
	// OR sustainable RPS increased by > 5%
	if (p95Pct <= -5.0 && errRatePct <= 0.5) ||
		(cur.SustainableRPS != nil && base.SustainableRPS != nil && *base.SustainableRPS > 0 &&
			*cur.SustainableRPS >= (*base.SustainableRPS)*1.05 && p95Pct <= 5.0 && errRatePct <= 0.5) {
		return domain.VerdictImproved
	}

	// Regressed: p95 rose by > 5%, OR error rate rose by > 1.0% pt,
	// OR sustainable RPS dropped by > 5%
	if p95Pct >= 5.0 || errRatePct >= 1.0 ||
		(cur.SustainableRPS != nil && base.SustainableRPS != nil && *base.SustainableRPS > 0 &&
			*cur.SustainableRPS <= (*base.SustainableRPS)*0.95) {
		return domain.VerdictRegressed
	}

	return domain.VerdictUnchanged
}
