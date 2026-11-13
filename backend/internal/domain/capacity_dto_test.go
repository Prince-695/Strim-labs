package domain_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCapacityThresholds_WithDefaults(t *testing.T) {
	// Zero values should trigger defaults
	ct := domain.CapacityThresholds{}
	def := ct.WithDefaults()
	assert.Equal(t, 2.0, def.P95Multiplier)
	assert.Equal(t, 0.01, def.MaxErrorRate)
	assert.Equal(t, 0.95, def.MinAchievedRatio)

	// Explicit custom values should be preserved
	custom := domain.CapacityThresholds{
		P95Multiplier:    3.5,
		MaxErrorRate:     0.05,
		MinAchievedRatio: 0.90,
	}
	res := custom.WithDefaults()
	assert.Equal(t, 3.5, res.P95Multiplier)
	assert.Equal(t, 0.05, res.MaxErrorRate)
	assert.Equal(t, 0.90, res.MinAchievedRatio)
}

func TestCapacityReport_TableName(t *testing.T) {
	report := domain.CapacityReport{}
	assert.Equal(t, "capacity_reports", report.TableName())
}

func TestCapacityReport_ToResponse(t *testing.T) {
	var nilReport *domain.CapacityReport
	assert.Nil(t, nilReport.ToResponse())

	now := time.Now().UTC()
	breakingRPS := 250.0
	reason := domain.BreakingReasonLatency
	report := &domain.CapacityReport{
		ID:               "cap-123",
		LoadTestID:       "test-456",
		OrgID:            "org-789",
		ProjectID:        "proj-012",
		SustainableRPS:   200.0,
		BreakingPointRPS: &breakingRPS,
		BreakingReason:   &reason,
		BaselineP95Ms:    25.5,
		Confidence:       domain.ConfidenceHigh,
		Note:             "Found sharp breaking point at step 5",
		Thresholds: domain.CapacityThresholds{
			P95Multiplier:    2.0,
			MaxErrorRate:     0.01,
			MinAchievedRatio: 0.95,
		},
		Windows: []domain.CapacityWindow{
			{
				Index:       1,
				StartSecond: 0,
				EndSecond:   10,
				OfferedRPS:  100,
				AchievedRPS: 100,
				P95Ms:       25.0,
				ErrorRate:   0,
				Healthy:     true,
			},
			{
				Index:         2,
				StartSecond:   10,
				EndSecond:     20,
				OfferedRPS:    250,
				AchievedRPS:   245,
				P95Ms:         75.0,
				ErrorRate:     0.02,
				Healthy:       false,
				FailureReason: &reason,
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	resp := report.ToResponse()
	require.NotNil(t, resp)
	assert.Equal(t, "cap-123", resp.ID)
	assert.Equal(t, "test-456", resp.LoadTestID)
	assert.Equal(t, 200.0, resp.SustainableRPS)
	assert.Equal(t, &breakingRPS, resp.BreakingPointRPS)
	assert.Equal(t, &reason, resp.BreakingReason)
	assert.Equal(t, 25.5, resp.BaselineP95Ms)
	assert.Equal(t, domain.ConfidenceHigh, resp.Confidence)
	assert.Len(t, resp.Windows, 2)
}

func TestCompareLoadTestsSerialization(t *testing.T) {
	req := domain.CompareLoadTestsRequest{
		TestIDs:    []string{"test-1", "test-2"},
		BaselineID: "test-1",
	}

	data, err := json.Marshal(req)
	require.NoError(t, err)

	var unmarshaled domain.CompareLoadTestsRequest
	err = json.Unmarshal(data, &unmarshaled)
	require.NoError(t, err)
	assert.Equal(t, req.TestIDs, unmarshaled.TestIDs)
	assert.Equal(t, req.BaselineID, unmarshaled.BaselineID)

	sustainVal := 420.0
	resp := domain.CompareLoadTestsResponse{
		BaselineID: "test-1",
		Tests: []domain.CompareTestSummary{
			{
				ID:             "test-1",
				Name:           "v1.0",
				AvgRPS:         280,
				PeakRPS:        498,
				P95MS:          220,
				ErrorRate:      0.013,
				SustainableRPS: &sustainVal,
			},
		},
		Deltas: []domain.CompareTestDelta{
			{
				TestID:       "test-2",
				AvgRPSPct:    7.1,
				PeakRPSPct:   8.4,
				P95Pct:       -13.6,
				ErrorRatePct: -0.5,
				Verdict:      domain.VerdictImproved,
			},
		},
		Overlay: domain.CompareOverlay{
			Step: "5s",
			Series: []domain.OverlaySeries{
				{
					TestID: "test-1",
					Name:   "v1.0",
					Points: []domain.OverlayPoint{
						{T: 0, OfferedRPS: 50, AchievedRPS: 50, P95: 30, Errors: 0},
					},
				},
			},
		},
	}

	respData, err := json.Marshal(resp)
	require.NoError(t, err)

	var unmarshaledResp domain.CompareLoadTestsResponse
	err = json.Unmarshal(respData, &unmarshaledResp)
	require.NoError(t, err)
	assert.Equal(t, resp.BaselineID, unmarshaledResp.BaselineID)
	assert.Len(t, unmarshaledResp.Tests, 1)
	assert.Len(t, unmarshaledResp.Deltas, 1)
	assert.Equal(t, domain.VerdictImproved, unmarshaledResp.Deltas[0].Verdict)
}
