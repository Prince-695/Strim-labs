package domain

import (
	"time"
)

// IngestEventItem represents a single telemetry event within an ingestion payload.
type IngestEventItem struct {
	TS         *time.Time `json:"ts,omitempty" example:"2026-11-11T12:00:00.123Z"`
	Method     string     `json:"method" validate:"required" example:"GET"`
	Path       string     `json:"path" validate:"required" example:"/orders/123"`
	Route      string     `json:"route,omitempty" example:"/orders/{id}"`
	Status     int        `json:"status" example:"200"`
	DurationMs float64    `json:"duration_ms" example:"41.7"`
	Bytes      int64      `json:"bytes,omitempty" example:"1820"`
	Error      *bool      `json:"error,omitempty" example:"false"`
}

// IngestEventsRequest defines the payload structure for POST /v1/ingest/events.
type IngestEventsRequest struct {
	Service string            `json:"service,omitempty" example:"orders"`
	Events  []IngestEventItem `json:"events" validate:"required,min=1,max=1000"`
}

// IngestEventError details an individual validation error in a batch.
type IngestEventError struct {
	Index  int    `json:"index" example:"4"`
	Reason string `json:"reason" example:"invalid status code"`
}

// IngestEventsResponse represents the result of an event ingestion batch.
type IngestEventsResponse struct {
	Accepted int                `json:"accepted" example:"998"`
	Rejected int                `json:"rejected" example:"2"`
	Errors   []IngestEventError `json:"errors,omitempty"`
}
