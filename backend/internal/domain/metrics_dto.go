package domain

import (
	"encoding/json"
	"errors"
	"time"
)

// MetricsOverviewResponse contains current window metrics and preceding comparative metrics.
type MetricsOverviewResponse struct {
	Current  MetricSummary   `json:"current"`
	Previous PreviousSummary `json:"previous"`
}

// TimeseriesPoint represents a single data point [RFC3339 timestamp, value|null].
type TimeseriesPoint struct {
	Timestamp time.Time
	Value     *float64
}

// MarshalJSON serializes TimeseriesPoint as a 2-element array [timestamp, value].
func (p TimeseriesPoint) MarshalJSON() ([]byte, error) {
	ts := p.Timestamp.UTC().Format(time.RFC3339)
	if p.Value == nil {
		return json.Marshal([]interface{}{ts, nil})
	}
	return json.Marshal([]interface{}{ts, *p.Value})
}

// UnmarshalJSON deserializes a 2-element array into TimeseriesPoint.
func (p *TimeseriesPoint) UnmarshalJSON(data []byte) error {
	var raw []interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	if len(raw) != 2 {
		return errors.New("invalid timeseries point format: expected 2 elements")
	}
	tsStr, ok := raw[0].(string)
	if !ok {
		return errors.New("invalid timestamp in timeseries point")
	}
	t, err := time.Parse(time.RFC3339, tsStr)
	if err != nil {
		return err
	}
	p.Timestamp = t

	if raw[1] != nil {
		switch v := raw[1].(type) {
		case float64:
			p.Value = &v
		case int:
			fl := float64(v)
			p.Value = &fl
		}
	}
	return nil
}

// TimeseriesSeries represents a keyed series of timeseries points.
type TimeseriesSeries struct {
	Key    string            `json:"key" example:"all"`
	Points []TimeseriesPoint `json:"points"`
}

// MetricTimeseriesResponse defines the response payload for timeseries queries.
type MetricTimeseriesResponse struct {
	Metric string             `json:"metric" example:"p95"`
	Unit   string             `json:"unit" example:"ms"`
	Step   string             `json:"step" example:"1m"`
	Series []TimeseriesSeries `json:"series"`
}

// EndpointMetricItem represents an endpoint row on the observability dashboard.
type EndpointMetricItem struct {
	EndpointID   string        `json:"endpoint_id" example:"018f3a5b-7c91-7b00-8000-000000000021"`
	Method       string        `json:"method" example:"GET"`
	PathTemplate string        `json:"path_template" example:"/orders/{id}"`
	Service      string        `json:"service" example:"orders"`
	Requests     int64         `json:"requests" example:"45000"`
	RPS          float64       `json:"rps" example:"12.5"`
	P50          float64       `json:"p50" example:"14.2"`
	P95          float64       `json:"p95" example:"65.0"`
	P99          float64       `json:"p99" example:"110.0"`
	ErrorRate    float64       `json:"error_rate" example:"0.002"`
	Health       ProjectHealth `json:"health" example:"healthy"`
}

// StatusCodeCount maps an individual HTTP status code to its observed count.
type StatusCodeCount struct {
	Status int   `json:"status" example:"200"`
	Count  int64 `json:"count" example:"135000"`
}

// StatusCodesResponse represents status code distribution across classes and individual codes.
type StatusCodesResponse struct {
	Classes map[string]int64  `json:"classes"`
	Codes   []StatusCodeCount `json:"codes"`
}

// HostsMetricsResponse represents system infrastructure host metrics.
type HostsMetricsResponse struct {
	Connected bool               `json:"connected" example:"false"`
	Host      string             `json:"host,omitempty"`
	Metric    string             `json:"metric,omitempty"`
	Series    []TimeseriesSeries `json:"series"`
}

// SSEOverviewData defines the event payload for the 'overview' SSE event.
type SSEOverviewData struct {
	TS                   time.Time `json:"ts" example:"2026-11-13T12:00:00Z"`
	RPS                  float64   `json:"rps" example:"33.4"`
	P95                  float64   `json:"p95" example:"182"`
	P99                  float64   `json:"p99" example:"410"`
	ErrorRate            float64   `json:"error_rate" example:"0.004"`
	RequestsLastInterval int64     `json:"requests_last_interval" example:"167"`
}

// SSEEndpointHealthData defines the event payload for the 'endpoint_health' SSE event.
type SSEEndpointHealthData struct {
	EndpointID string        `json:"endpoint_id" example:"018f3a5b-7c91-7b00-8000-000000000021"`
	Health     ProjectHealth `json:"health" example:"degraded"`
}
