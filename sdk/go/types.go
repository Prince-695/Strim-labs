package strim

import "time"

// Event represents a single telemetry event.
type Event struct {
	TS         time.Time `json:"ts"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	Route      string    `json:"route,omitempty"`
	Status     int       `json:"status"`
	DurationMS float64   `json:"duration_ms"`
	Bytes      int64     `json:"bytes"`
	Error      bool      `json:"error"`
}

// Config configures the Strim client.
type Config struct {
	APIKey        string        // Project API Key (required)
	Endpoint      string        // Default: https://api.strimlabs.com
	Service       string        // Default: api
	BatchSize     int           // Default: 50
	FlushInterval time.Duration // Default: 2s
	Debug         bool
}

type ingestPayload struct {
	Service string  `json:"service"`
	Events  []Event `json:"events"`
}
