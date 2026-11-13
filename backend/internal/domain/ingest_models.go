package domain

import (
	"time"
)

// RequestEvent represents a raw HTTP request telemetry event.
type RequestEvent struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID  string    `gorm:"type:uuid;not null;index:idx_events_proj_ts" json:"project_id"`
	Timestamp  time.Time `gorm:"not null;index:idx_events_proj_ts" json:"ts"`
	Method     string    `gorm:"type:varchar(10);not null" json:"method"`
	Route      string    `gorm:"type:varchar(2048);not null;index" json:"route"`
	Status     int       `gorm:"not null" json:"status"`
	DurationMs float64   `gorm:"not null" json:"duration_ms"`
	Bytes      int64     `gorm:"not null;default:0" json:"bytes"`
	IsError    bool      `gorm:"not null;index" json:"is_error"`
	Service    string    `gorm:"type:varchar(100);default:''" json:"service"`
}

// TableName overrides GORM default table name for raw events.
func (RequestEvent) TableName() string {
	return "request_events_raw"
}

// RequestRollup represents an aggregated time-series metric bucket.
type RequestRollup struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID    string    `gorm:"type:uuid;not null" json:"project_id"`
	EndpointKey  string    `gorm:"type:varchar(2058);not null" json:"endpoint_key"`
	Bucket       time.Time `gorm:"not null" json:"bucket"`
	Count        int64     `gorm:"not null;default:0" json:"count"`
	Errors       int64     `gorm:"not null;default:0" json:"errors"`
	SumMs        float64   `gorm:"not null;default:0" json:"sum_ms"`
	MinMs        float64   `gorm:"not null;default:0" json:"min_ms"`
	MaxMs        float64   `gorm:"not null;default:0" json:"max_ms"`
	Histogram    []byte    `gorm:"type:bytea;not null" json:"histogram"`
	StatusCounts JSONMap   `gorm:"type:jsonb;not null;default:'{}'" json:"status_counts"`
	CreatedAt    time.Time `gorm:"not null;autoCreateTime" json:"created_at"`
}

// RequestRollup1m represents the 1-minute aggregation table.
type RequestRollup1m struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID    string    `gorm:"type:uuid;not null;uniqueIndex:idx_r1m_p_k_b" json:"project_id"`
	EndpointKey  string    `gorm:"type:varchar(2058);not null;uniqueIndex:idx_r1m_p_k_b" json:"endpoint_key"`
	Bucket       time.Time `gorm:"not null;uniqueIndex:idx_r1m_p_k_b" json:"bucket"`
	Count        int64     `gorm:"not null;default:0" json:"count"`
	Errors       int64     `gorm:"not null;default:0" json:"errors"`
	SumMs        float64   `gorm:"not null;default:0" json:"sum_ms"`
	MinMs        float64   `gorm:"not null;default:0" json:"min_ms"`
	MaxMs        float64   `gorm:"not null;default:0" json:"max_ms"`
	Histogram    []byte    `gorm:"type:bytea;not null" json:"histogram"`
	StatusCounts JSONMap   `gorm:"type:jsonb;not null;default:'{}'" json:"status_counts"`
	CreatedAt    time.Time `gorm:"not null;autoCreateTime" json:"created_at"`
}

func (RequestRollup1m) TableName() string {
	return "request_rollup_1m"
}

// RequestRollup1h represents the 1-hour aggregation table.
type RequestRollup1h struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID    string    `gorm:"type:uuid;not null;uniqueIndex:idx_r1h_p_k_b" json:"project_id"`
	EndpointKey  string    `gorm:"type:varchar(2058);not null;uniqueIndex:idx_r1h_p_k_b" json:"endpoint_key"`
	Bucket       time.Time `gorm:"not null;uniqueIndex:idx_r1h_p_k_b" json:"bucket"`
	Count        int64     `gorm:"not null;default:0" json:"count"`
	Errors       int64     `gorm:"not null;default:0" json:"errors"`
	SumMs        float64   `gorm:"not null;default:0" json:"sum_ms"`
	MinMs        float64   `gorm:"not null;default:0" json:"min_ms"`
	MaxMs        float64   `gorm:"not null;default:0" json:"max_ms"`
	Histogram    []byte    `gorm:"type:bytea;not null" json:"histogram"`
	StatusCounts JSONMap   `gorm:"type:jsonb;not null;default:'{}'" json:"status_counts"`
	CreatedAt    time.Time `gorm:"not null;autoCreateTime" json:"created_at"`
}

func (RequestRollup1h) TableName() string {
	return "request_rollup_1h"
}
