package domain

import (
	"time"
)

// DailyUsageCounter records day-level resource consumption per organization.
type DailyUsageCounter struct {
	ID                string    `gorm:"primaryKey;size:36" json:"id"`
	OrgID             string    `gorm:"size:36;not null;uniqueIndex:idx_org_date" json:"org_id"`
	Date              string    `gorm:"size:10;not null;uniqueIndex:idx_org_date" json:"date"` // "YYYY-MM-DD"
	EventsIngested    int64     `gorm:"not null;default:0" json:"events_ingested"`
	LoadTestMinutes   int64     `gorm:"not null;default:0" json:"load_test_minutes"`
	RequestsGenerated int64     `gorm:"not null;default:0" json:"requests_generated"`
	CreatedAt         time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt         time.Time `gorm:"not null" json:"updated_at"`
}

// TableName returns GORM table name for DailyUsageCounter.
func (DailyUsageCounter) TableName() string {
	return "daily_usage_counters"
}

// DefaultPlanLimits represents standard free/starter tier resource allowances.
var DefaultPlanLimits = OrgPlanLimits{
	EventsIngestedLimit:    5_000_000,
	LoadTestMinutesLimit:   300,
	RequestsGeneratedLimit: 10_000_000,
	ProjectsLimit:          5,
}

// OrgPlanLimits defines threshold ceilings for an organization.
type OrgPlanLimits struct {
	EventsIngestedLimit    int64 `json:"events_ingested_limit"`
	LoadTestMinutesLimit   int64 `json:"load_test_minutes_limit"`
	RequestsGeneratedLimit int64 `json:"requests_generated_limit"`
	ProjectsLimit          int64 `json:"projects_limit"`
}
