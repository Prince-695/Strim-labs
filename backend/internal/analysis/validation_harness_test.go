package analysis_test

import (
	"fmt"
	"math"
	"testing"

	"github.com/Prince-695/strim/backend/internal/analysis"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestValidationHarness_KnownBottleneck asserts that the capacity analyzer
// estimates sustainable capacity within ±15% of a known ground-truth bottleneck.
// Per PRD Section 8.4 and Implementation Phases: Phase 8 Exit Criteria.
func TestValidationHarness_KnownBottleneck(t *testing.T) {
	testCases := []struct {
		name              string
		knownCapacityRPS  float64
		stepSeconds       int
		stepOfferedRates  []float64
		expectedSustain   float64
		expectedBreak     float64
		expectedReason    string
		toleranceFraction float64 // 0.15 = ±15%
	}{
		{
			name:              "Fixed worker pool saturating at 60 RPS",
			knownCapacityRPS:  60.0,
			stepSeconds:       10,
			stepOfferedRates:  []float64{20, 40, 60, 80, 100, 120},
			expectedSustain:   60.0,
			expectedBreak:     80.0,
			expectedReason:    domain.BreakingReasonSaturation,
			toleranceFraction: 0.15,
		},
		{
			name:              "Database lock bottleneck degrading latency at 150 RPS",
			knownCapacityRPS:  150.0,
			stepSeconds:       10,
			stepOfferedRates:  []float64{50, 100, 150, 200, 250, 300},
			expectedSustain:   150.0,
			expectedBreak:     200.0,
			expectedReason:    domain.BreakingReasonLatency,
			toleranceFraction: 0.15,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			test := &domain.LoadTest{
				ID:        "test-harness-" + tc.name,
				OrgID:     "org-harness",
				ProjectID: "proj-harness",
				Profile:   domain.ProfileStep,
				Config: domain.JSONMap{
					"step": map[string]interface{}{
						"step_seconds": tc.stepSeconds,
					},
				},
			}

			// Generate synthetic timeseries reflecting the physical bottleneck behavior
			var points []*domain.LoadTestTimeseries
			currentSec := 0
			baselineLatency := 20.0

			for _, offered := range tc.stepOfferedRates {
				for s := 0; s < tc.stepSeconds; s++ {
					var achieved float64
					var p95 float64
					var errors int

					if offered <= tc.knownCapacityRPS {
						// Under capacity: 100% achieved, baseline latency, 0 errors
						achieved = offered
						p95 = baselineLatency + math.Sin(float64(s))*1.5
						errors = 0
					} else {
						// Over capacity: bottleneck triggered
						if tc.expectedReason == domain.BreakingReasonSaturation {
							// Pure saturation: throughput strictly caps at known capacity, 0 errors
							achieved = tc.knownCapacityRPS
							p95 = baselineLatency + 2.0
							errors = 0
						} else {
							// Latency balloons due to resource contention (cubed growth past threshold)
							achieved = offered
							p95 = baselineLatency * math.Pow(offered/tc.knownCapacityRPS, 3)
							errors = 0
						}
					}

					points = append(points, &domain.LoadTestTimeseries{
						ID:          fmt.Sprintf("ts-%d", currentSec),
						TestID:      test.ID,
						Second:      currentSec,
						OfferedRPS:  offered,
						AchievedRPS: achieved,
						P95:         p95,
						Errors:      errors,
					})
					currentSec++
				}
			}

			report := analysis.AnalyzeCapacity(test, points, domain.CapacityThresholds{}, nil)
			require.NotNil(t, report)

			// Assert sustainable RPS estimate is within ±15% of known limit
			maxAllowedDelta := tc.knownCapacityRPS * tc.toleranceFraction
			assert.InDeltaf(
				t,
				tc.knownCapacityRPS,
				report.SustainableRPS,
				maxAllowedDelta,
				"Estimated sustainable RPS %.1f must be within ±15%% of known limit %.1f (delta <= %.1f)",
				report.SustainableRPS,
				tc.knownCapacityRPS,
				maxAllowedDelta,
			)

			// Assert breaking point was reached and identified
			require.NotNil(t, report.BreakingPointRPS, "Breaking point should be detected")
			breakDelta := tc.expectedBreak * tc.toleranceFraction
			assert.InDeltaf(
				t,
				tc.expectedBreak,
				*report.BreakingPointRPS,
				breakDelta,
				"Breaking point %.1f must be within ±15%% of expected %.1f",
				*report.BreakingPointRPS,
				tc.expectedBreak,
			)

			// Assert root-cause reason
			require.NotNil(t, report.BreakingReason)
			assert.Equal(t, tc.expectedReason, *report.BreakingReason)

			// Assert confidence is high for multi-step test with clear failure
			assert.Equal(t, domain.ConfidenceHigh, report.Confidence)
		})
	}
}
