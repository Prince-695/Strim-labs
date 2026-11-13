package domain_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDiagnosticsDTO_Serialization(t *testing.T) {
	// 1. SlowEndpointsResponse
	now := time.Now().UTC()
	slowResp := domain.SlowEndpointsResponse{
		Range:          "1h",
		TotalEvaluated: 5,
		Endpoints: []domain.SlowEndpointItem{
			{
				EndpointID:  "ep-1",
				Method:      "POST",
				Route:       "/checkout",
				Service:     "order-svc",
				Requests:    1200,
				P50MS:       50.0,
				P95MS:       210.0,
				P99MS:       450.0,
				ErrorRate:   0.015,
				ImpactScore: 252000.0,
			},
		},
	}

	b, err := json.Marshal(slowResp)
	require.NoError(t, err)

	var unmarshaledSlow domain.SlowEndpointsResponse
	require.NoError(t, json.Unmarshal(b, &unmarshaledSlow))
	assert.Equal(t, slowResp.Range, unmarshaledSlow.Range)
	assert.Len(t, unmarshaledSlow.Endpoints, 1)
	assert.Equal(t, 252000.0, unmarshaledSlow.Endpoints[0].ImpactScore)

	// 2. RegressionsResponse
	regResp := domain.RegressionsResponse{
		Baseline:     "previous",
		Range:        "1h",
		ThresholdPct: 15.0,
		Regressions: []domain.RegressionItem{
			{
				EndpointID:    "ep-1",
				Method:        "GET",
				Route:         "/catalog",
				Service:       "catalog-svc",
				Metric:        "p95_latency",
				BaselineValue: 80.0,
				CurrentValue:  140.0,
				ChangePct:     75.0,
				Severity:      domain.RegressionSeverityCritical,
			},
		},
	}

	b, err = json.Marshal(regResp)
	require.NoError(t, err)

	var unmarshaledReg domain.RegressionsResponse
	require.NoError(t, json.Unmarshal(b, &unmarshaledReg))
	assert.Equal(t, domain.RegressionSeverityCritical, unmarshaledReg.Regressions[0].Severity)

	// 3. BottlenecksResponse
	botResp := domain.BottlenecksResponse{
		Range: "24h",
		Hints: []domain.BottleneckHint{
			{
				Kind:       "hint",
				Type:       domain.BottleneckTypeTailLatencyDispersion,
				Confidence: domain.ConfidenceMedium,
				Message:    "P99 latency is 6x median latency",
				Evidence: map[string]interface{}{
					"p50_ms": 30.0,
					"p99_ms": 180.0,
					"ratio":  6.0,
				},
			},
		},
	}

	b, err = json.Marshal(botResp)
	require.NoError(t, err)

	var unmarshaledBot domain.BottlenecksResponse
	require.NoError(t, json.Unmarshal(b, &unmarshaledBot))
	assert.Equal(t, "hint", unmarshaledBot.Hints[0].Kind)
	assert.Equal(t, domain.BottleneckTypeTailLatencyDispersion, unmarshaledBot.Hints[0].Type)

	// 4. Query structs
	q := domain.SlowEndpointsQuery{
		Range:       "custom",
		Start:       &now,
		End:         &now,
		Limit:       20,
		MinRequests: 5,
	}
	b, err = json.Marshal(q)
	require.NoError(t, err)
	var unmarshaledQ domain.SlowEndpointsQuery
	require.NoError(t, json.Unmarshal(b, &unmarshaledQ))
	assert.Equal(t, 20, unmarshaledQ.Limit)
}
