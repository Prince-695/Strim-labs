package domain

import (
	"time"
)

// Supported metric types for time-series queries.
const (
	MetricRPS         = "rps"
	MetricRequests    = "requests"
	MetricP50         = "p50"
	MetricP95         = "p95"
	MetricP99         = "p99"
	MetricAvg         = "avg"
	MetricErrorRate   = "error_rate"
	MetricSuccessRate = "success_rate"
	MetricTimeouts    = "timeouts"
)

// GroupBy options for time-series queries.
const (
	GroupByEndpoint    = "endpoint"
	GroupByStatusClass = "status_class"
)

// TimeRange represents a parsed query time window.
type TimeRange struct {
	Start    time.Time
	End      time.Time
	Duration time.Duration
	Step     time.Duration
}

// MetricSummary encapsulates standard latency and throughput metrics.
type MetricSummary struct {
	Requests    int64   `json:"total_requests" example:"153000"`
	RPS         float64 `json:"rps" example:"42.5"`
	P50         float64 `json:"p50" example:"18.2"`
	P90         float64 `json:"p90" example:"45.0"`
	P95         float64 `json:"p95" example:"82.4"`
	P99         float64 `json:"p99" example:"145.0"`
	Avg         float64 `json:"avg" example:"24.1"`
	Min         float64 `json:"min" example:"1.2"`
	Max         float64 `json:"max" example:"850.0"`
	ErrorRate   float64 `json:"error_rate" example:"0.008"`
	SuccessRate float64 `json:"success_rate" example:"0.992"`
	ErrorCount  int64   `json:"error_count" example:"1224"`
}

// PreviousSummary represents the comparative metrics for the prior time window.
type PreviousSummary struct {
	Requests  int64   `json:"total_requests" example:"137160"`
	RPS       float64 `json:"rps" example:"38.1"`
	P95       float64 `json:"p95" example:"88.0"`
	ErrorRate float64 `json:"error_rate" example:"0.012"`
}
