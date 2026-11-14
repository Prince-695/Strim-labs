package domain

import "time"

// BuildInfo represents the metadata of the compiled server binary.
type BuildInfo struct {
	Version string `json:"version" example:"1.0.0"`
	Commit  string `json:"commit" example:"e2d016c"`
	BuiltAt string `json:"built_at" example:"2026-11-13T20:37:35Z"`
}

// HealthzResponse defines liveness probe status.
type HealthzResponse struct {
	Status string    `json:"status" example:"ok"`
	Time   time.Time `json:"time" example:"2026-11-14T12:00:00Z"`
}

// ReadyzResponse defines readiness probe status.
type ReadyzResponse struct {
	Status   string `json:"status" example:"ready"`
	Database string `json:"database" example:"connected"`
}
