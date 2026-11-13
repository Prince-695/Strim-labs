package domain

import (
	"time"
)

// Regression severity levels.
const (
	RegressionSeverityCritical = "critical"
	RegressionSeverityWarning  = "warning"
	RegressionSeverityInfo     = "info"
)

// Bottleneck hint types.
const (
	BottleneckTypeThroughputSaturation       = "throughput_saturation"
	BottleneckTypeTailLatencyDispersion      = "tail_latency_dispersion"
	BottleneckTypeLoadCorrelatedErrors       = "load_correlated_errors"
	BottleneckTypeHighExecutionConcentration = "high_execution_concentration"
)

// SlowEndpointsQuery specifies parameters for querying slowest endpoints.
type SlowEndpointsQuery struct {
	Range       string     `json:"range"`
	Start       *time.Time `json:"start,omitempty"`
	End         *time.Time `json:"end,omitempty"`
	Limit       int        `json:"limit"`
	MinRequests int        `json:"min_requests"`
}

// SlowEndpointItem represents an endpoint ranked by volume-weighted impact score.
type SlowEndpointItem struct {
	EndpointID  string  `json:"endpoint_id,omitempty"`
	Method      string  `json:"method"`
	Route       string  `json:"route"`
	Service     string  `json:"service"`
	Requests    int64   `json:"requests"`
	P50MS       float64 `json:"p50_ms"`
	P95MS       float64 `json:"p95_ms"`
	P99MS       float64 `json:"p99_ms"`
	ErrorRate   float64 `json:"error_rate"`
	ImpactScore float64 `json:"impact_score"`
}

// SlowEndpointsResponse encapsulates the ranked slow endpoints response payload.
type SlowEndpointsResponse struct {
	Range          string             `json:"range"`
	TotalEvaluated int                `json:"total_evaluated"`
	Endpoints      []SlowEndpointItem `json:"endpoints"`
}

// RegressionsQuery specifies parameters for detecting performance regressions.
type RegressionsQuery struct {
	Range        string     `json:"range"`
	Start        *time.Time `json:"start,omitempty"`
	End          *time.Time `json:"end,omitempty"`
	Baseline     string     `json:"baseline"`
	ThresholdPct float64    `json:"threshold_pct"`
}

// RegressionItem describes a single endpoint regression event relative to baseline.
type RegressionItem struct {
	EndpointID    string  `json:"endpoint_id,omitempty"`
	Method        string  `json:"method"`
	Route         string  `json:"route"`
	Service       string  `json:"service"`
	Metric        string  `json:"metric"`
	BaselineValue float64 `json:"baseline_value"`
	CurrentValue  float64 `json:"current_value"`
	ChangePct     float64 `json:"change_pct"`
	Severity      string  `json:"severity"`
}

// RegressionsResponse encapsulates the regression detection response payload.
type RegressionsResponse struct {
	Baseline     string           `json:"baseline"`
	Range        string           `json:"range"`
	ThresholdPct float64          `json:"threshold_pct"`
	Regressions  []RegressionItem `json:"regressions"`
}

// BottleneckHint provides diagnostic correlation observations labeled explicitly as hints.
type BottleneckHint struct {
	Kind       string                 `json:"kind"` // Always "hint"
	Type       string                 `json:"type"`
	Confidence string                 `json:"confidence"`
	Message    string                 `json:"message"`
	Evidence   map[string]interface{} `json:"evidence"`
}

// BottlenecksResponse encapsulates the diagnostic bottleneck hints response payload.
type BottlenecksResponse struct {
	Range string           `json:"range"`
	Hints []BottleneckHint `json:"hints"`
}
