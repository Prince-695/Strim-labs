package domain

import (
	"time"
)

// Confidence level constants for capacity reports.
const (
	ConfidenceHigh   = "high"
	ConfidenceMedium = "medium"
	ConfidenceLow    = "low"
)

// Breaking reason constants for capacity reports.
const (
	BreakingReasonLatency    = "latency"
	BreakingReasonErrors     = "errors"
	BreakingReasonSaturation = "saturation"
)

// Verdict constants for test comparisons.
const (
	VerdictImproved  = "improved"
	VerdictRegressed = "regressed"
	VerdictUnchanged = "unchanged"
)

// CapacityWindow represents a discrete evaluation slice during a load test.
type CapacityWindow struct {
	Index         int     `json:"index"`
	StartSecond   int     `json:"start_second"`
	EndSecond     int     `json:"end_second"`
	OfferedRPS    float64 `json:"offered_rps"`
	AchievedRPS   float64 `json:"achieved_rps"`
	P95Ms         float64 `json:"p95_ms"`
	ErrorRate     float64 `json:"error_rate"`
	Healthy       bool    `json:"healthy"`
	FailureReason *string `json:"failure_reason,omitempty"`
}

// CapacityReport stores the analyzed capacity limits, breaking point, and window health for a load test.
type CapacityReport struct {
	ID               string             `gorm:"primaryKey;size:36" json:"id"`
	LoadTestID       string             `gorm:"uniqueIndex;size:36;not null" json:"load_test_id"`
	OrgID            string             `gorm:"index;size:36;not null" json:"org_id"`
	ProjectID        string             `gorm:"index;size:36;not null" json:"project_id"`
	SustainableRPS   float64            `gorm:"not null" json:"sustainable_rps"`
	BreakingPointRPS *float64           `json:"breaking_point_rps"`
	BreakingReason   *string            `gorm:"size:32" json:"breaking_reason,omitempty"`
	BaselineP95Ms    float64            `gorm:"not null" json:"baseline_p95_ms"`
	Confidence       string             `gorm:"size:16;not null" json:"confidence"`
	Note             string             `gorm:"type:text" json:"note"`
	Thresholds       CapacityThresholds `gorm:"serializer:json" json:"thresholds"`
	Windows          []CapacityWindow   `gorm:"serializer:json" json:"windows"`
	CreatedAt        time.Time          `gorm:"not null" json:"created_at"`
	UpdatedAt        time.Time          `gorm:"not null" json:"updated_at"`
}

// TableName returns the database table name for GORM.
func (CapacityReport) TableName() string {
	return "capacity_reports"
}
