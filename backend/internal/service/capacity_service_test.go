package service_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupCapacityServiceTest(t *testing.T) (service.CapacityService, repository.CapacityRepository, repository.LoadTestRepository) {
	capRepo := repository.NewInMemoryCapacityRepository()
	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	svc := service.NewCapacityService(capRepo, loadTestRepo)
	return svc, capRepo, loadTestRepo
}

func TestCapacityService_GetCapacityReport(t *testing.T) {
	ctx := context.Background()
	svc, capRepo, loadTestRepo := setupCapacityServiceTest(t)

	// 1. Test not finished -> 409
	runningTest := &domain.LoadTest{
		ID:        "test-running",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Running Test",
		Status:    domain.LoadTestStatusRunning,
	}
	require.NoError(t, loadTestRepo.Create(ctx, runningTest))

	_, err := svc.GetCapacityReport(ctx, "proj-1", "test-running")
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeTestNotFinished, appErr.ErrorCode)

	// 2. Test not found / cross project -> 404
	_, err = svc.GetCapacityReport(ctx, "proj-other", "test-running")
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeNotFound, appErr.ErrorCode)

	// 3. Completed test with pre-existing capacity report
	completedTest := &domain.LoadTest{
		ID:        "test-done",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Done Test",
		Status:    domain.LoadTestStatusCompleted,
	}
	require.NoError(t, loadTestRepo.Create(ctx, completedTest))

	existingReport := &domain.CapacityReport{
		ID:             "cap-done",
		LoadTestID:     "test-done",
		OrgID:          "org-1",
		ProjectID:      "proj-1",
		SustainableRPS: 180.0,
		Confidence:     domain.ConfidenceHigh,
		CreatedAt:      time.Now().UTC(),
	}
	require.NoError(t, capRepo.Save(ctx, existingReport))

	rep, err := svc.GetCapacityReport(ctx, "proj-1", "test-done")
	require.NoError(t, err)
	require.NotNil(t, rep)
	assert.Equal(t, 180.0, rep.SustainableRPS)

	// 4. Completed test WITHOUT pre-existing report -> computes and saves
	legacyTest := &domain.LoadTest{
		ID:        "test-legacy",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Legacy Test",
		Status:    domain.LoadTestStatusCompleted,
		Profile:   domain.ProfileRamp,
	}
	require.NoError(t, loadTestRepo.Create(ctx, legacyTest))

	var tsList []*domain.LoadTestTimeseries
	for i := 0; i < 20; i++ {
		tsList = append(tsList, &domain.LoadTestTimeseries{
			ID:          "ts-leg",
			TestID:      "test-legacy",
			Second:      i,
			OfferedRPS:  float64(50 + i*5),
			AchievedRPS: float64(50 + i*5),
			P95:         15.0,
		})
	}
	require.NoError(t, loadTestRepo.CreateTimeseriesBatch(ctx, tsList))

	legacyRep, err := svc.GetCapacityReport(ctx, "proj-1", "test-legacy")
	require.NoError(t, err)
	require.NotNil(t, legacyRep)
	assert.Greater(t, legacyRep.SustainableRPS, 50.0)

	savedRep, err := capRepo.FindByLoadTestID(ctx, "test-legacy")
	require.NoError(t, err)
	require.NotNil(t, savedRep)
}

func TestCapacityService_RecomputeCapacity(t *testing.T) {
	ctx := context.Background()
	svc, capRepo, loadTestRepo := setupCapacityServiceTest(t)

	test := &domain.LoadTest{
		ID:        "test-recompute",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Recompute Test",
		Status:    domain.LoadTestStatusCompleted,
		Profile:   domain.ProfileStep,
	}
	require.NoError(t, loadTestRepo.Create(ctx, test))

	var tsList []*domain.LoadTestTimeseries
	for i := 0; i < 20; i++ {
		p95 := 20.0
		if i >= 10 {
			p95 = 50.0 // jumps to 50ms at second 10
		}
		tsList = append(tsList, &domain.LoadTestTimeseries{
			ID:          "ts-rec",
			TestID:      "test-recompute",
			Second:      i,
			OfferedRPS:  float64(100 + i*10),
			AchievedRPS: float64(100 + i*10),
			P95:         p95,
		})
	}
	require.NoError(t, loadTestRepo.CreateTimeseriesBatch(ctx, tsList))

	// Recompute with relaxed multiplier (4.0x) -> 50ms <= 20*4.0 (80ms), so it stays healthy
	relaxed := domain.CapacityThresholds{
		P95Multiplier:    4.0,
		MaxErrorRate:     0.05,
		MinAchievedRatio: 0.90,
	}
	repRelaxed, err := svc.RecomputeCapacity(ctx, "proj-1", "test-recompute", domain.RecomputeCapacityRequest{
		Thresholds: &relaxed,
		Save:       false,
	})
	require.NoError(t, err)
	assert.Nil(t, repRelaxed.BreakingPointRPS)

	// Since Save was false, DB should not have this report
	dbRep, _ := capRepo.FindByLoadTestID(ctx, "test-recompute")
	assert.Nil(t, dbRep)

	// Recompute with tight multiplier (1.5x) and Save: true
	tight := domain.CapacityThresholds{
		P95Multiplier:    1.5,
		MaxErrorRate:     0.01,
		MinAchievedRatio: 0.95,
	}
	repTight, err := svc.RecomputeCapacity(ctx, "proj-1", "test-recompute", domain.RecomputeCapacityRequest{
		Thresholds: &tight,
		Save:       true,
	})
	require.NoError(t, err)
	require.NotNil(t, repTight.BreakingPointRPS)

	// Verify report is now saved in DB
	saved, err := capRepo.FindByLoadTestID(ctx, "test-recompute")
	require.NoError(t, err)
	require.NotNil(t, saved)
	assert.Equal(t, repTight.BreakingPointRPS, saved.BreakingPointRPS)
}

func TestCapacityService_CompareLoadTests(t *testing.T) {
	ctx := context.Background()
	svc, capRepo, loadTestRepo := setupCapacityServiceTest(t)

	// 1. Validation: < 2 IDs
	_, err := svc.CompareLoadTests(ctx, "proj-1", domain.CompareLoadTestsRequest{
		TestIDs: []string{"test-1"},
	})
	require.Error(t, err)

	// 2. Validation: > 5 IDs
	_, err = svc.CompareLoadTests(ctx, "proj-1", domain.CompareLoadTestsRequest{
		TestIDs: []string{"1", "2", "3", "4", "5", "6"},
	})
	require.Error(t, err)

	// 3. Validation: duplicate IDs
	_, err = svc.CompareLoadTests(ctx, "proj-1", domain.CompareLoadTestsRequest{
		TestIDs: []string{"test-1", "test-1"},
	})
	require.Error(t, err)

	// Setup 3 tests: v1 (baseline), v2 (improved: lower latency), v3 (regressed: high error rate)
	tests := []*domain.LoadTest{
		{ID: "test-v1", OrgID: "org-1", ProjectID: "proj-1", Name: "v1.0", Status: domain.LoadTestStatusCompleted},
		{ID: "test-v2", OrgID: "org-1", ProjectID: "proj-1", Name: "v1.1", Status: domain.LoadTestStatusCompleted},
		{ID: "test-v3", OrgID: "org-1", ProjectID: "proj-1", Name: "v1.2", Status: domain.LoadTestStatusCompleted},
	}
	for _, tt := range tests {
		require.NoError(t, loadTestRepo.Create(ctx, tt))
	}

	// Add results
	v1Summary := domain.LoadTestSummary{AvgRPS: 200, PeakRPS: 300, LatencyMS: domain.LoadTestLatencySummary{P95: 100}, ErrorRate: 0.01}
	v2Summary := domain.LoadTestSummary{AvgRPS: 220, PeakRPS: 330, LatencyMS: domain.LoadTestLatencySummary{P95: 70}, ErrorRate: 0.005} // improved
	v3Summary := domain.LoadTestSummary{AvgRPS: 180, PeakRPS: 250, LatencyMS: domain.LoadTestLatencySummary{P95: 160}, ErrorRate: 0.04} // regressed

	s1, _ := json.Marshal(v1Summary)
	s2, _ := json.Marshal(v2Summary)
	s3, _ := json.Marshal(v3Summary)

	var m1, m2, m3 domain.JSONMap
	_ = json.Unmarshal(s1, &m1)
	_ = json.Unmarshal(s2, &m2)
	_ = json.Unmarshal(s3, &m3)

	_ = loadTestRepo.CreateResults(ctx, &domain.LoadTestResults{TestID: "test-v1", Summary: m1})
	_ = loadTestRepo.CreateResults(ctx, &domain.LoadTestResults{TestID: "test-v2", Summary: m2})
	_ = loadTestRepo.CreateResults(ctx, &domain.LoadTestResults{TestID: "test-v3", Summary: m3})

	// Add capacity reports
	_ = capRepo.Save(ctx, &domain.CapacityReport{ID: "c1", LoadTestID: "test-v1", ProjectID: "proj-1", SustainableRPS: 200})
	_ = capRepo.Save(ctx, &domain.CapacityReport{ID: "c2", LoadTestID: "test-v2", ProjectID: "proj-1", SustainableRPS: 230})
	_ = capRepo.Save(ctx, &domain.CapacityReport{ID: "c3", LoadTestID: "test-v3", ProjectID: "proj-1", SustainableRPS: 150})

	// Add timeseries points for overlay
	for sec := 0; sec <= 15; sec += 5 {
		_ = loadTestRepo.CreateTimeseriesBatch(ctx, []*domain.LoadTestTimeseries{
			{ID: "ts-v1", TestID: "test-v1", Second: sec, OfferedRPS: 200, AchievedRPS: 200, P95: 100},
			{ID: "ts-v2", TestID: "test-v2", Second: sec, OfferedRPS: 220, AchievedRPS: 220, P95: 70},
			{ID: "ts-v3", TestID: "test-v3", Second: sec, OfferedRPS: 180, AchievedRPS: 170, P95: 160},
		})
	}

	resp, err := svc.CompareLoadTests(ctx, "proj-1", domain.CompareLoadTestsRequest{
		TestIDs:    []string{"test-v1", "test-v2", "test-v3"},
		BaselineID: "test-v1",
	})
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "test-v1", resp.BaselineID)
	assert.Len(t, resp.Tests, 3)
	assert.Len(t, resp.Deltas, 2)

	// v2 delta checks
	deltaV2 := resp.Deltas[0]
	assert.Equal(t, "test-v2", deltaV2.TestID)
	assert.Equal(t, 10.0, deltaV2.AvgRPSPct)
	assert.Equal(t, 10.0, deltaV2.PeakRPSPct)
	assert.Equal(t, -30.0, deltaV2.P95Pct) // p95 dropped 100 -> 70 (-30%)
	assert.Equal(t, domain.VerdictImproved, deltaV2.Verdict)

	// v3 delta checks
	deltaV3 := resp.Deltas[1]
	assert.Equal(t, "test-v3", deltaV3.TestID)
	assert.Equal(t, -10.0, deltaV3.AvgRPSPct)
	assert.Equal(t, 60.0, deltaV3.P95Pct) // p95 rose 100 -> 160 (+60%)
	assert.Equal(t, domain.VerdictRegressed, deltaV3.Verdict)

	// Overlay checks
	assert.Equal(t, "5s", resp.Overlay.Step)
	assert.Len(t, resp.Overlay.Series, 3)
}
