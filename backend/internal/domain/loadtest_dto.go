package domain

import (
	"strings"
	"time"
)

// TargetItemRequest represents an individual target inside CreateLoadTestRequest.
type TargetItemRequest struct {
	EndpointID string            `json:"endpoint_id,omitempty" example:"018f3a5b-7c91-7b00-8000-000000000021"`
	Method     string            `json:"method" validate:"required,oneof=GET POST PUT PATCH DELETE HEAD OPTIONS" example:"POST"`
	Path       string            `json:"path" validate:"required" example:"/orders"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       string            `json:"body,omitempty" example:"{\"item\":\"laptop\",\"qty\":1}"`
	Weight     int               `json:"weight" validate:"gte=1" example:"1"`
}

// CreateLoadTestRequest represents the payload for POST /v1/organizations/:orgID/projects/:projectID/load-tests.
type CreateLoadTestRequest struct {
	Name               string              `json:"name" validate:"required,min=2,max=100" example:"Checkout Ramp Test"`
	Model              LoadTestModel       `json:"model" validate:"required,oneof=open closed" example:"open"`
	Profile            LoadTestProfile     `json:"profile" validate:"required,oneof=sustained ramp spike step" example:"ramp"`
	Targets            []TargetItemRequest `json:"targets" validate:"required,min=1,max=20,dive"`
	StartRate          float64             `json:"start_rate" validate:"gte=0" example:"10"`
	PeakRate           float64             `json:"peak_rate" validate:"gte=0" example:"500"`
	RampUpSeconds      int                 `json:"ramp_up_seconds" validate:"gte=0" example:"120"`
	DurationSeconds    int                 `json:"duration_seconds" validate:"required,gt=0,lte=1800" example:"300"`
	MaxVirtualUsers    int                 `json:"max_virtual_users" validate:"gte=0,lte=500" example:"200"`
	TotalRequests      *int64              `json:"total_requests,omitempty" validate:"omitempty,gt=0"`
	TimeoutMS          int                 `json:"timeout_ms" validate:"gte=100,lte=60000" example:"5000"`
	ThinkTimeMS        int                 `json:"think_time_ms" validate:"gte=0" example:"0"`
	Spike              *SpikeConfig        `json:"spike,omitempty"`
	Step               *StepConfig         `json:"step,omitempty"`
	CapacityThresholds *CapacityThresholds `json:"capacity_thresholds,omitempty"`
	StartNow           bool                `json:"start_now" example:"true"`
}

// LoadTestResponse represents the standardized summary response for a load test.
type LoadTestResponse struct {
	ID           string          `json:"id" example:"018f3a5b-7c91-7b00-8000-000000000099"`
	OrgID        string          `json:"org_id" example:"018f3a5b-7c91-7b00-8000-000000000001"`
	ProjectID    string          `json:"project_id" example:"018f3a5b-7c91-7b00-8000-000000000010"`
	Name         string          `json:"name" example:"Checkout Ramp Test"`
	Model        LoadTestModel   `json:"model" example:"open"`
	Profile      LoadTestProfile `json:"profile" example:"ramp"`
	Status       LoadTestStatus  `json:"status" example:"queued"`
	Config       LoadTestConfig  `json:"config"`
	CreatedBy    string          `json:"created_by" example:"018f3a5b-7c91-7b00-8000-000000000002"`
	StartedAt    *time.Time      `json:"started_at,omitempty" example:"2026-11-13T20:00:00Z"`
	FinishedAt   *time.Time      `json:"finished_at,omitempty"`
	ErrorMessage *string         `json:"error_message,omitempty"`
	CreatedAt    time.Time       `json:"created_at" example:"2026-11-13T19:59:00Z"`
	UpdatedAt    time.Time       `json:"updated_at" example:"2026-11-13T20:00:00Z"`
}

// LoadTestDetailResponse includes LoadTestResponse and the optional completed summary.
type LoadTestDetailResponse struct {
	LoadTestResponse
	Summary *LoadTestSummary `json:"summary,omitempty"`
}

// LoadTestResultsResponse represents the full breakdown returned by GET /results.
type LoadTestResultsResponse struct {
	Summary             LoadTestSummary             `json:"summary"`
	PerEndpoint         []PerEndpointResult         `json:"per_endpoint"`
	LatencyDistribution []LatencyDistributionBucket `json:"latency_distribution"`
	Flags               LoadTestFlags               `json:"flags"`
}

// TimeseriesPointLoadTest captures offered vs achieved metrics for a given second.
type TimeseriesPointLoadTest struct {
	T           int     `json:"t" example:"0"`
	OfferedRPS  float64 `json:"offered_rps" example:"10"`
	AchievedRPS float64 `json:"achieved_rps" example:"10"`
	P50         float64 `json:"p50" example:"41"`
	P95         float64 `json:"p95" example:"80"`
	P99         float64 `json:"p99" example:"120"`
	Errors      int     `json:"errors" example:"0"`
	Active      int     `json:"active" example:"3"`
}

// LoadTestTimeseriesResponse represents the response payload for GET /timeseries.
type LoadTestTimeseriesResponse struct {
	Step   string                    `json:"step" example:"1s"`
	Points []TimeseriesPointLoadTest `json:"points"`
}

// SSEProgressSnapshotData represents the payload for the SSE 'snapshot' event.
type SSEProgressSnapshotData struct {
	Status         LoadTestStatus         `json:"status" example:"running"`
	ElapsedSeconds int                    `json:"elapsed_seconds" example:"0"`
	ConfigSummary  map[string]interface{} `json:"config_summary"`
}

// SSEProgressTickData represents the payload for the per-second SSE 'tick' event.
type SSEProgressTickData struct {
	T             int              `json:"t" example:"1"`
	OfferedRPS    float64          `json:"offered_rps" example:"10"`
	AchievedRPS   float64          `json:"achieved_rps" example:"10"`
	P50           float64          `json:"p50" example:"40"`
	P95           float64          `json:"p95" example:"82"`
	P99           float64          `json:"p99" example:"120"`
	Errors        int              `json:"errors" example:"0"`
	Active        int              `json:"active" example:"3"`
	TotalRequests int64            `json:"total_requests" example:"10"`
	StatusCodes   map[string]int64 `json:"status_codes"`
}

// SSEProgressStatusData represents the payload for the SSE 'status' event.
type SSEProgressStatusData struct {
	Status LoadTestStatus `json:"status" example:"completed"`
}

// SSEProgressEndData represents the payload for the SSE 'end' event.
type SSEProgressEndData struct {
	Reason string `json:"reason" example:"completed"`
}

// MaskSensitiveHeaders redacts secret headers like Authorization, Cookie, API keys with "***".
func MaskSensitiveHeaders(headers map[string]string) map[string]string {
	if headers == nil {
		return nil
	}
	masked := make(map[string]string, len(headers))
	for k, v := range headers {
		lowerKey := strings.ToLower(k)
		if strings.Contains(lowerKey, "auth") ||
			strings.Contains(lowerKey, "token") ||
			strings.Contains(lowerKey, "cookie") ||
			strings.Contains(lowerKey, "secret") ||
			strings.Contains(lowerKey, "key") {
			masked[k] = "***"
		} else {
			masked[k] = v
		}
	}
	return masked
}
