package domain

import (
	"time"
)

// LoadTestModel defines the arrival model: open (arrival rate) or closed (virtual users).
type LoadTestModel string

const (
	ModelOpen   LoadTestModel = "open"
	ModelClosed LoadTestModel = "closed"
)

// LoadTestProfile defines the load profile pattern.
type LoadTestProfile string

const (
	ProfileSustained LoadTestProfile = "sustained"
	ProfileRamp      LoadTestProfile = "ramp"
	ProfileSpike     LoadTestProfile = "spike"
	ProfileStep      LoadTestProfile = "step"
)

// LoadTestStatus defines the lifecycle status of a load test.
type LoadTestStatus string

const (
	LoadTestStatusDraft     LoadTestStatus = "draft"
	LoadTestStatusQueued    LoadTestStatus = "queued"
	LoadTestStatusRunning   LoadTestStatus = "running"
	LoadTestStatusCompleted LoadTestStatus = "completed"
	LoadTestStatusStopped   LoadTestStatus = "stopped"
	LoadTestStatusFailed    LoadTestStatus = "failed"
)

// JobStatus defines the execution state of an asynchronous background job.
type JobStatus string

const (
	JobStatusQueued    JobStatus = "queued"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
	JobStatusCancelled JobStatus = "cancelled"
)

// LoadTestTarget defines an individual target endpoint for a load test run.
type LoadTestTarget struct {
	EndpointID string            `json:"endpoint_id,omitempty"`
	Method     string            `json:"method"`
	Path       string            `json:"path"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       string            `json:"body,omitempty"`
	Weight     int               `json:"weight"`
}

// SpikeConfig holds parameters for the spike profile.
type SpikeConfig struct {
	BaseRate             float64 `json:"base_rate"`
	SpikeRate            float64 `json:"spike_rate"`
	SpikeAtSeconds       int     `json:"spike_at_seconds"`
	SpikeDurationSeconds int     `json:"spike_duration_seconds"`
}

// StepConfig holds parameters for the step profile.
type StepConfig struct {
	StartRate   float64 `json:"start_rate"`
	StepRate    float64 `json:"step_rate"`
	StepSeconds int     `json:"step_seconds"`
	MaxRate     float64 `json:"max_rate"`
}

// CapacityThresholds defines custom pass/fail criteria for capacity determination.
type CapacityThresholds struct {
	P95Multiplier    float64 `json:"p95_multiplier"`
	MaxErrorRate     float64 `json:"max_error_rate"`
	MinAchievedRatio float64 `json:"min_achieved_ratio,omitempty"`
}

// WithDefaults returns a copy of CapacityThresholds with standard defaults populated.
func (ct CapacityThresholds) WithDefaults() CapacityThresholds {
	res := ct
	if res.P95Multiplier <= 0 {
		res.P95Multiplier = 2.0
	}
	if res.MaxErrorRate <= 0 {
		res.MaxErrorRate = 0.01 // 1%
	}
	if res.MinAchievedRatio <= 0 {
		res.MinAchievedRatio = 0.95 // 95%
	}
	return res
}

// LoadTestConfig contains the full operational configuration for a load test.
type LoadTestConfig struct {
	Model              LoadTestModel       `json:"model,omitempty"`
	Profile            LoadTestProfile     `json:"profile,omitempty"`
	Targets            []LoadTestTarget    `json:"targets"`
	StartRate          float64             `json:"start_rate"`
	PeakRate           float64             `json:"peak_rate"`
	RampUpSeconds      int                 `json:"ramp_up_seconds"`
	DurationSeconds    int                 `json:"duration_seconds"`
	MaxVirtualUsers    int                 `json:"max_virtual_users"`
	TotalRequests      *int64              `json:"total_requests,omitempty"`
	TimeoutMS          int                 `json:"timeout_ms"`
	ThinkTimeMS        int                 `json:"think_time_ms"`
	Spike              *SpikeConfig        `json:"spike,omitempty"`
	Step               *StepConfig         `json:"step,omitempty"`
	CapacityThresholds *CapacityThresholds `json:"capacity_thresholds,omitempty"`
}

// LoadTest represents a load test experiment record stored in the database.
type LoadTest struct {
	ID           string          `gorm:"primaryKey;size:36" json:"id"`
	OrgID        string          `gorm:"index;size:36;not null" json:"org_id"`
	ProjectID    string          `gorm:"index;size:36;not null" json:"project_id"`
	Name         string          `gorm:"size:128;not null" json:"name"`
	Model        LoadTestModel   `gorm:"size:16;not null" json:"model"`
	Profile      LoadTestProfile `gorm:"size:16;not null" json:"profile"`
	Status       LoadTestStatus  `gorm:"index;size:32;not null" json:"status"`
	Config       JSONMap         `gorm:"type:text" json:"config"`
	CreatedBy    string          `gorm:"size:36;not null" json:"created_by"`
	StartedAt    *time.Time      `json:"started_at,omitempty"`
	FinishedAt   *time.Time      `json:"finished_at,omitempty"`
	ErrorMessage *string         `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt    time.Time       `gorm:"not null" json:"created_at"`
	UpdatedAt    time.Time       `gorm:"not null" json:"updated_at"`
}

// TableName returns the table name for GORM.
func (LoadTest) TableName() string {
	return "load_tests"
}

// LoadTestLatencySummary represents latency percentiles and summary statistics.
type LoadTestLatencySummary struct {
	P50 float64 `json:"p50"`
	P90 float64 `json:"p90"`
	P95 float64 `json:"p95"`
	P99 float64 `json:"p99"`
	Max float64 `json:"max"`
	Avg float64 `json:"avg"`
}

// LoadTestSummary aggregates the final results across an entire test run.
type LoadTestSummary struct {
	TotalRequests   int64                  `json:"total_requests"`
	Successful      int64                  `json:"successful"`
	Failed          int64                  `json:"failed"`
	AvgRPS          float64                `json:"avg_rps"`
	PeakRPS         float64                `json:"peak_rps"`
	LatencyMS       LoadTestLatencySummary `json:"latency_ms"`
	ErrorRate       float64                `json:"error_rate"`
	Timeouts        int64                  `json:"timeouts"`
	StatusCodes     map[string]int64       `json:"status_codes"`
	BytesReceived   int64                  `json:"bytes_received"`
	DurationSeconds int                    `json:"duration_seconds"`
}

// PerEndpointResult represents the breakdown for a single target endpoint.
type PerEndpointResult struct {
	Method    string                 `json:"method"`
	Path      string                 `json:"path"`
	Requests  int64                  `json:"requests"`
	ErrorRate float64                `json:"error_rate"`
	LatencyMS LoadTestLatencySummary `json:"latency_ms"`
}

// LatencyDistributionBucket provides histogram cumulative bucket counts.
type LatencyDistributionBucket struct {
	LeMS  float64 `json:"le_ms"`
	Count int64   `json:"count"`
}

// LoadTestFlags records execution anomalies or engine saturation flags.
type LoadTestFlags struct {
	GeneratorSaturated bool  `json:"generator_saturated"`
	MaxScheduleLagMS   int64 `json:"max_schedule_lag_ms"`
}

// LoadTestResults stores the aggregated results and histogram for a completed test.
type LoadTestResults struct {
	TestID              string    `gorm:"primaryKey;size:36" json:"test_id"`
	Summary             JSONMap   `gorm:"type:text" json:"summary"`
	PerEndpoint         JSONMap   `gorm:"type:text" json:"per_endpoint"`
	LatencyDistribution JSONMap   `gorm:"type:text" json:"latency_distribution"`
	Flags               JSONMap   `gorm:"type:text" json:"flags"`
	Histogram           []byte    `gorm:"type:blob" json:"-"`
	CreatedAt           time.Time `gorm:"not null" json:"created_at"`
}

// TableName returns the table name for GORM.
func (LoadTestResults) TableName() string {
	return "load_test_results"
}

// LoadTestTimeseries captures a 1-second interval execution snapshot.
type LoadTestTimeseries struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	TestID       string    `gorm:"index;size:36;not null" json:"test_id"`
	Second       int       `gorm:"not null" json:"t"`
	OfferedRPS   float64   `json:"offered_rps"`
	AchievedRPS  float64   `json:"achieved_rps"`
	Errors       int       `json:"errors"`
	P50          float64   `json:"p50"`
	P95          float64   `json:"p95"`
	P99          float64   `json:"p99"`
	StatusCounts JSONMap   `gorm:"type:text" json:"status_codes"`
	Active       int       `json:"active"`
	CreatedAt    time.Time `gorm:"not null" json:"created_at"`
}

// TableName returns the table name for GORM.
func (LoadTestTimeseries) TableName() string {
	return "load_test_timeseries"
}

// Job represents an asynchronous task item in the job queue.
type Job struct {
	ID        string     `gorm:"primaryKey;size:36" json:"id"`
	Type      string     `gorm:"size:64;not null;index" json:"type"`
	Payload   string     `gorm:"type:text;not null" json:"payload"`
	Status    JobStatus  `gorm:"size:32;not null;index" json:"status"`
	RunAt     time.Time  `gorm:"index;not null" json:"run_at"`
	LockedBy  *string    `gorm:"size:128" json:"locked_by,omitempty"`
	LockedAt  *time.Time `json:"locked_at,omitempty"`
	Attempts  int        `gorm:"default:0" json:"attempts"`
	LastError *string    `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt time.Time  `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time  `gorm:"not null" json:"updated_at"`
}

// TableName returns the table name for GORM.
func (Job) TableName() string {
	return "jobs"
}
