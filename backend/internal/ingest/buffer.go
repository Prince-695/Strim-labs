package ingest

import (
	"time"
)

// RequestEvent represents an observed API request event per PRD Section 6.6.
type RequestEvent struct {
	ProjectID  string    `json:"project_id"`
	Timestamp  time.Time `json:"timestamp"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	Route      string    `json:"route,omitempty"`
	Status     int       `json:"status"`
	DurationMS float64   `json:"duration_ms"`
	Bytes      int64     `json:"bytes"`
	IsError    bool      `json:"is_error"`
}

// IngestBuffer provides an in-memory bounded ring/channel buffer for high-throughput batching.
type IngestBuffer struct {
	events chan RequestEvent
}

// NewIngestBuffer initializes a bounded event buffer.
func NewIngestBuffer(capacity int) *IngestBuffer {
	return &IngestBuffer{
		events: make(chan RequestEvent, capacity),
	}
}

// Push adds an event to the buffer; returns false if buffer is full (triggering backpressure 429/503).
func (b *IngestBuffer) Push(event RequestEvent) bool {
	select {
	case b.events <- event:
		return true
	default:
		return false
	}
}

// Events returns the receive channel for batch flush workers.
func (b *IngestBuffer) Events() <-chan RequestEvent {
	return b.events
}
