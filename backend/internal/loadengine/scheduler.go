package loadengine

import "time"

// LoadProfile defines the arrival pattern: sustained, ramp, spike, or step.
type LoadProfile string

const (
	ProfileSustained LoadProfile = "sustained"
	ProfileRamp      LoadProfile = "ramp"
	ProfileSpike     LoadProfile = "spike"
	ProfileStep      LoadProfile = "step"
)

// LoadModel defines open (arrival rate) vs closed (virtual users).
type LoadModel string

const (
	ModelOpen   LoadModel = "open"
	ModelClosed LoadModel = "closed"
)

// TestConfig holds validated configuration for a load test run.
type TestConfig struct {
	Model        LoadModel     `json:"model"`
	Profile      LoadProfile   `json:"profile"`
	TargetURL    string        `json:"target_url"`
	BaseRPS      int           `json:"base_rps"`
	PeakRPS      int           `json:"peak_rps"`
	Duration     time.Duration `json:"duration"`
	RampUp       time.Duration `json:"ramp_up"`
	VirtualUsers int           `json:"virtual_users"`
}
