package analysis

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/google/uuid"
)

// AnalyzeCapacity processes 1-second load test timeseries metrics and produces a CapacityReport.
func AnalyzeCapacity(
	test *domain.LoadTest,
	timeseries []*domain.LoadTestTimeseries,
	thresholds domain.CapacityThresholds,
	flags *domain.LoadTestFlags,
) *domain.CapacityReport {
	thresholds = thresholds.WithDefaults()
	now := time.Now().UTC()

	report := &domain.CapacityReport{
		ID:         uuid.New().String(),
		LoadTestID: test.ID,
		OrgID:      test.OrgID,
		ProjectID:  test.ProjectID,
		Thresholds: thresholds,
		Windows:    make([]domain.CapacityWindow, 0),
		Confidence: domain.ConfidenceLow,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if len(timeseries) == 0 {
		report.Note = "No timeseries metrics recorded for load test"
		return report
	}

	// Sort timeseries chronologically by second
	sorted := make([]*domain.LoadTestTimeseries, len(timeseries))
	copy(sorted, timeseries)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Second < sorted[j].Second
	})

	// Determine window size
	windowSize := determineWindowSize(test, len(sorted))

	// Slice timeseries into windows
	windows := buildWindows(sorted, windowSize, test.Profile)
	if len(windows) == 0 {
		report.Note = "Insufficient data points to evaluate windows"
		return report
	}

	// Compute baseline P95 from initial healthy traffic
	baselineP95 := windows[0].P95Ms
	if baselineP95 < 1.0 {
		baselineP95 = 1.0 // floor at 1.0ms to prevent sensitivity anomalies
	}
	report.BaselineP95Ms = math.Round(baselineP95*10) / 10

	// Evaluate health for each window
	maxAllowedP95 := baselineP95 * thresholds.P95Multiplier
	for i := range windows {
		w := &windows[i]
		healthy := true
		var failureReason string

		if w.ErrorRate > thresholds.MaxErrorRate {
			healthy = false
			failureReason = domain.BreakingReasonErrors
		} else if w.OfferedRPS > 0 && w.AchievedRPS < (thresholds.MinAchievedRatio*w.OfferedRPS) {
			healthy = false
			failureReason = domain.BreakingReasonSaturation
		} else if w.P95Ms > maxAllowedP95 {
			healthy = false
			failureReason = domain.BreakingReasonLatency
		}

		w.Healthy = healthy
		if !healthy {
			reasonCopy := failureReason
			w.FailureReason = &reasonCopy
		}
	}
	report.Windows = windows

	// Calculate Sustainable RPS: highest offered RPS where this and all prior windows are healthy
	sustainableRPS := 0.0
	for _, w := range windows {
		if !w.Healthy {
			break
		}
		if w.OfferedRPS > sustainableRPS {
			sustainableRPS = w.OfferedRPS
		}
	}
	report.SustainableRPS = math.Round(sustainableRPS*10) / 10

	// Calculate Breaking Point: first offered RPS where 2 consecutive windows are unhealthy
	var breakingRPS *float64
	var breakingReason *string

	for i := 0; i < len(windows)-1; i++ {
		if !windows[i].Healthy && !windows[i+1].Healthy {
			val := math.Round(windows[i].OfferedRPS*10) / 10
			breakingRPS = &val
			breakingReason = windows[i].FailureReason
			break
		}
	}

	// If there's only 1 unhealthy window at the very end or total windows == 1,
	// and it's unhealthy, we still check if test ended on failure
	if breakingRPS == nil && len(windows) == 1 && !windows[0].Healthy {
		val := math.Round(windows[0].OfferedRPS*10) / 10
		breakingRPS = &val
		breakingReason = windows[0].FailureReason
	}

	report.BreakingPointRPS = breakingRPS
	report.BreakingReason = breakingReason

	// Assign Confidence & Diagnostic Notes
	assignConfidenceAndNotes(report, test, flags, len(windows), breakingRPS != nil)

	return report
}

func determineWindowSize(test *domain.LoadTest, totalSeconds int) int {
	if test.Profile == domain.ProfileStep && len(test.Config) > 0 {
		var cfg domain.LoadTestConfig
		data, err := json.Marshal(test.Config)
		if err == nil && json.Unmarshal(data, &cfg) == nil {
			if cfg.Step != nil && cfg.Step.StepSeconds > 0 {
				return cfg.Step.StepSeconds
			}
		}
	}

	// For ramp, sustained, or spike
	if totalSeconds >= 30 {
		return 10
	}
	if totalSeconds >= 10 {
		return 5
	}
	if totalSeconds >= 3 {
		return totalSeconds / 3
	}
	return 1
}

func buildWindows(points []*domain.LoadTestTimeseries, windowSize int, profile domain.LoadTestProfile) []domain.CapacityWindow {
	if windowSize <= 0 {
		windowSize = 10
	}

	var windows []domain.CapacityWindow
	total := len(points)

	for i := 0; i < total; i += windowSize {
		end := i + windowSize
		if end > total {
			end = total
		}

		slice := points[i:end]
		// If tail slice is too small (< 50% of window size) and we already have windows,
		// merge tail into the preceding window unless it's a step test
		if len(slice) < windowSize/2 && len(windows) > 0 && profile != domain.ProfileStep {
			lastIdx := len(windows) - 1
			mergeSliceIntoWindow(&windows[lastIdx], slice)
			continue
		}

		w := aggregateSlice(slice, len(windows)+1)
		windows = append(windows, w)
	}

	return windows
}

func aggregateSlice(slice []*domain.LoadTestTimeseries, index int) domain.CapacityWindow {
	startSec := slice[0].Second
	endSec := slice[len(slice)-1].Second

	var sumOffered, sumAchieved, sumP95 float64
	var sumErrors int64
	var sumTotalRequests int64

	for _, pt := range slice {
		sumOffered += pt.OfferedRPS
		sumAchieved += pt.AchievedRPS
		sumP95 += pt.P95
		sumErrors += int64(pt.Errors)

		// Estimate total requests as achieved RPS + errors if not directly available
		reqCount := int64(pt.AchievedRPS) + int64(pt.Errors)
		if reqCount <= 0 && pt.OfferedRPS > 0 {
			reqCount = int64(pt.OfferedRPS)
		}
		sumTotalRequests += reqCount
	}

	n := float64(len(slice))
	offered := sumOffered / n
	achieved := sumAchieved / n
	p95 := sumP95 / n

	errorRate := 0.0
	if sumTotalRequests > 0 {
		errorRate = float64(sumErrors) / float64(sumTotalRequests)
	}

	return domain.CapacityWindow{
		Index:       index,
		StartSecond: startSec,
		EndSecond:   endSec,
		OfferedRPS:  math.Round(offered*10) / 10,
		AchievedRPS: math.Round(achieved*10) / 10,
		P95Ms:       math.Round(p95*10) / 10,
		ErrorRate:   math.Round(errorRate*10000) / 10000,
		Healthy:     true,
	}
}

func mergeSliceIntoWindow(w *domain.CapacityWindow, slice []*domain.LoadTestTimeseries) {
	if len(slice) == 0 {
		return
	}
	w.EndSecond = slice[len(slice)-1].Second
	// Average with tail slice
	tail := aggregateSlice(slice, 0)
	w.OfferedRPS = math.Round(((w.OfferedRPS+tail.OfferedRPS)/2.0)*10) / 10
	w.AchievedRPS = math.Round(((w.AchievedRPS+tail.AchievedRPS)/2.0)*10) / 10
	w.P95Ms = math.Round(((w.P95Ms+tail.P95Ms)/2.0)*10) / 10
	w.ErrorRate = math.Round(((w.ErrorRate+tail.ErrorRate)/2.0)*10000) / 10000
}

func assignConfidenceAndNotes(
	report *domain.CapacityReport,
	test *domain.LoadTest,
	flags *domain.LoadTestFlags,
	numWindows int,
	hasBreakingPoint bool,
) {
	hasLag := flags != nil && flags.GeneratorSaturated

	if hasLag {
		report.Confidence = domain.ConfidenceLow
		report.Note = "Generator experienced schedule lag; results reflect client bottlenecks, not server capacity"
		return
	}

	if test.Profile == domain.ProfileSustained {
		report.Confidence = domain.ConfidenceLow
		report.Note = "Sustained profile at a constant rate cannot determine breaking point; a ramp or step test is recommended"
		return
	}

	if !hasBreakingPoint {
		if numWindows >= 5 {
			report.Confidence = domain.ConfidenceMedium
		} else {
			report.Confidence = domain.ConfidenceLow
		}
		report.Note = fmt.Sprintf("Capacity is at least %.0f RPS; raise max rate to find breaking point", report.SustainableRPS)
		return
	}

	// Breaking point was reached
	if numWindows >= 5 {
		report.Confidence = domain.ConfidenceHigh
		report.Note = fmt.Sprintf("Breaking point detected at %.0f RPS due to %s", *report.BreakingPointRPS, *report.BreakingReason)
	} else if numWindows >= 3 {
		report.Confidence = domain.ConfidenceMedium
		report.Note = fmt.Sprintf("Breaking point detected at %.0f RPS due to %s", *report.BreakingPointRPS, *report.BreakingReason)
	} else {
		report.Confidence = domain.ConfidenceLow
		report.Note = "Test duration too short for high-confidence capacity calculation"
	}
}
