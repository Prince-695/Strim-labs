package analysis_test

import (
	"fmt"
	"testing"

	"github.com/Prince-695/strim/backend/internal/analysis"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateStepTimeseries(steps []struct {
	offered  float64
	achieved float64
	p95      float64
	errors   int
	seconds  int
}) []*domain.LoadTestTimeseries {
	var points []*domain.LoadTestTimeseries
	currentSec := 0

	for _, step := range steps {
		for s := 0; s < step.seconds; s++ {
			points = append(points, &domain.LoadTestTimeseries{
				ID:          fmt.Sprintf("ts-%d", currentSec),
				TestID:      "test-1",
				Second:      currentSec,
				OfferedRPS:  step.offered,
				AchievedRPS: step.achieved,
				P95:         step.p95,
				Errors:      step.errors,
			})
			currentSec++
		}
	}
	return points
}

func TestAnalyzeCapacity_CleanStepBreak(t *testing.T) {
	test := &domain.LoadTest{
		ID:        "test-clean",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Profile:   domain.ProfileStep,
		Config: domain.JSONMap{
			"step": map[string]interface{}{
				"step_seconds": 10,
			},
		},
	}

	// 6 steps of 10s: 50, 100, 150, 200, 250, 300 RPS
	// Baseline P95 is ~20ms (max allowed is 40ms)
	// Steps 1 to 4 healthy (P95 <= 35ms)
	// Step 5 (250 RPS): P95 = 55ms (fails latency)
	// Step 6 (300 RPS): P95 = 90ms (fails latency)
	steps := []struct {
		offered  float64
		achieved float64
		p95      float64
		errors   int
		seconds  int
	}{
		{offered: 50, achieved: 50, p95: 20.0, errors: 0, seconds: 10},
		{offered: 100, achieved: 100, p95: 22.0, errors: 0, seconds: 10},
		{offered: 150, achieved: 150, p95: 26.0, errors: 0, seconds: 10},
		{offered: 200, achieved: 200, p95: 32.0, errors: 0, seconds: 10},
		{offered: 250, achieved: 250, p95: 55.0, errors: 0, seconds: 10},
		{offered: 300, achieved: 300, p95: 90.0, errors: 0, seconds: 10},
	}

	ts := generateStepTimeseries(steps)
	report := analysis.AnalyzeCapacity(test, ts, domain.CapacityThresholds{}, nil)

	require.NotNil(t, report)
	assert.Equal(t, 200.0, report.SustainableRPS)
	require.NotNil(t, report.BreakingPointRPS)
	assert.Equal(t, 250.0, *report.BreakingPointRPS)
	require.NotNil(t, report.BreakingReason)
	assert.Equal(t, domain.BreakingReasonLatency, *report.BreakingReason)
	assert.Equal(t, domain.ConfidenceHigh, report.Confidence)
	assert.Equal(t, 6, len(report.Windows))
	assert.True(t, report.Windows[0].Healthy)
	assert.True(t, report.Windows[3].Healthy)
	assert.False(t, report.Windows[4].Healthy)
	assert.False(t, report.Windows[5].Healthy)
}

func TestAnalyzeCapacity_NoisyTransientSpike(t *testing.T) {
	test := &domain.LoadTest{
		ID:        "test-noisy",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Profile:   domain.ProfileStep,
		Config: domain.JSONMap{
			"step": map[string]interface{}{
				"step_seconds": 10,
			},
		},
	}

	// Step 3 encounters a transient GC spike (P95=60ms) but step 4 recovers (P95=28ms)
	// Steps 1 to 5 never have 2 consecutive failures
	steps := []struct {
		offered  float64
		achieved float64
		p95      float64
		errors   int
		seconds  int
	}{
		{offered: 50, achieved: 50, p95: 20.0, errors: 0, seconds: 10},
		{offered: 100, achieved: 100, p95: 22.0, errors: 0, seconds: 10},
		{offered: 150, achieved: 150, p95: 60.0, errors: 0, seconds: 10}, // transient spike
		{offered: 200, achieved: 200, p95: 28.0, errors: 0, seconds: 10}, // recovers!
		{offered: 250, achieved: 250, p95: 32.0, errors: 0, seconds: 10},
	}

	ts := generateStepTimeseries(steps)
	report := analysis.AnalyzeCapacity(test, ts, domain.CapacityThresholds{}, nil)

	require.NotNil(t, report)
	// Breaking point must NOT be triggered because 2 consecutive failures did not occur
	assert.Nil(t, report.BreakingPointRPS)
	assert.Equal(t, 100.0, report.SustainableRPS) // highest offered prior to first failure
	assert.Contains(t, report.Note, "Capacity is at least")
}

func TestAnalyzeCapacity_NeverBreaks(t *testing.T) {
	test := &domain.LoadTest{
		ID:        "test-strong",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Profile:   domain.ProfileRamp,
	}

	// 50 seconds of ramp: offered grows 10 -> 100, all perfectly healthy
	var points []*domain.LoadTestTimeseries
	for sec := 0; sec < 50; sec++ {
		rate := float64(10 + (sec * 2))
		points = append(points, &domain.LoadTestTimeseries{
			ID:          fmt.Sprintf("ts-%d", sec),
			TestID:      "test-strong",
			Second:      sec,
			OfferedRPS:  rate,
			AchievedRPS: rate,
			P95:         15.0,
			Errors:      0,
		})
	}

	report := analysis.AnalyzeCapacity(test, points, domain.CapacityThresholds{}, nil)
	require.NotNil(t, report)
	assert.Nil(t, report.BreakingPointRPS)
	assert.Nil(t, report.BreakingReason)
	assert.Greater(t, report.SustainableRPS, 90.0)
	assert.Contains(t, report.Note, "raise max rate to find breaking point")
}

func TestAnalyzeCapacity_ImmediateBreak(t *testing.T) {
	test := &domain.LoadTest{
		ID:        "test-fail-early",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Profile:   domain.ProfileStep,
		Config: domain.JSONMap{
			"step": map[string]interface{}{
				"step_seconds": 10,
			},
		},
	}

	// From the first 2 steps, error rate is 10% (> 1% allowed)
	steps := []struct {
		offered  float64
		achieved float64
		p95      float64
		errors   int
		seconds  int
	}{
		{offered: 100, achieved: 90, p95: 25.0, errors: 10, seconds: 10},
		{offered: 200, achieved: 180, p95: 35.0, errors: 20, seconds: 10},
	}

	ts := generateStepTimeseries(steps)
	report := analysis.AnalyzeCapacity(test, ts, domain.CapacityThresholds{}, nil)

	require.NotNil(t, report)
	assert.Equal(t, 0.0, report.SustainableRPS)
	require.NotNil(t, report.BreakingPointRPS)
	assert.Equal(t, 100.0, *report.BreakingPointRPS)
	require.NotNil(t, report.BreakingReason)
	assert.Equal(t, domain.BreakingReasonErrors, *report.BreakingReason)
}

func TestAnalyzeCapacity_GeneratorLag(t *testing.T) {
	test := &domain.LoadTest{
		ID:        "test-lag",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Profile:   domain.ProfileRamp,
	}

	var points []*domain.LoadTestTimeseries
	for sec := 0; sec < 30; sec++ {
		points = append(points, &domain.LoadTestTimeseries{
			ID:          fmt.Sprintf("ts-%d", sec),
			TestID:      "test-lag",
			Second:      sec,
			OfferedRPS:  100,
			AchievedRPS: 100,
			P95:         20.0,
			Errors:      0,
		})
	}

	flags := &domain.LoadTestFlags{
		GeneratorSaturated: true,
		MaxScheduleLagMS:   350,
	}

	report := analysis.AnalyzeCapacity(test, points, domain.CapacityThresholds{}, flags)
	require.NotNil(t, report)
	assert.Equal(t, domain.ConfidenceLow, report.Confidence)
	assert.Contains(t, report.Note, "Generator experienced schedule lag")
}

func TestAnalyzeCapacity_SustainedProfile(t *testing.T) {
	test := &domain.LoadTest{
		ID:        "test-sustained",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Profile:   domain.ProfileSustained,
	}

	var points []*domain.LoadTestTimeseries
	for sec := 0; sec < 30; sec++ {
		points = append(points, &domain.LoadTestTimeseries{
			ID:          fmt.Sprintf("ts-%d", sec),
			TestID:      "test-sustained",
			Second:      sec,
			OfferedRPS:  50,
			AchievedRPS: 50,
			P95:         18.0,
			Errors:      0,
		})
	}

	report := analysis.AnalyzeCapacity(test, points, domain.CapacityThresholds{}, nil)
	require.NotNil(t, report)
	assert.Equal(t, domain.ConfidenceLow, report.Confidence)
	assert.Contains(t, report.Note, "ramp or step test is recommended")
}

func TestAnalyzeCapacity_SaturationFailure(t *testing.T) {
	test := &domain.LoadTest{
		ID:        "test-sat",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Profile:   domain.ProfileStep,
		Config: domain.JSONMap{
			"step": map[string]interface{}{
				"step_seconds": 10,
			},
		},
	}

	// At 200 offered RPS, server only delivers 150 achieved RPS (< 95% of offered)
	steps := []struct {
		offered  float64
		achieved float64
		p95      float64
		errors   int
		seconds  int
	}{
		{offered: 100, achieved: 100, p95: 15.0, errors: 0, seconds: 10},
		{offered: 200, achieved: 150, p95: 20.0, errors: 0, seconds: 10}, // saturation
		{offered: 300, achieved: 150, p95: 25.0, errors: 0, seconds: 10}, // saturation
	}

	ts := generateStepTimeseries(steps)
	report := analysis.AnalyzeCapacity(test, ts, domain.CapacityThresholds{}, nil)

	require.NotNil(t, report)
	assert.Equal(t, 100.0, report.SustainableRPS)
	require.NotNil(t, report.BreakingPointRPS)
	assert.Equal(t, 200.0, *report.BreakingPointRPS)
	require.NotNil(t, report.BreakingReason)
	assert.Equal(t, domain.BreakingReasonSaturation, *report.BreakingReason)
}
