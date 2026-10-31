package analysis

// BreakingReason identifies which limit was breached first.
type BreakingReason string

const (
	ReasonLatency    BreakingReason = "latency"
	ReasonErrors     BreakingReason = "errors"
	ReasonSaturation BreakingReason = "saturation"
	ReasonNone       BreakingReason = "none"
)

// ConfidenceLevel quantifies confidence in the calculated breaking point.
type ConfidenceLevel string

const (
	ConfidenceHigh   ConfidenceLevel = "high"
	ConfidenceMedium ConfidenceLevel = "medium"
	ConfidenceLow    ConfidenceLevel = "low"
)

// CapacityReport encapsulates capacity evaluation outputs per PRD Section 8.4.
type CapacityReport struct {
	SustainableRPS   int             `json:"sustainable_rps"`
	BreakingPointRPS int             `json:"breaking_point_rps"`
	Reason           BreakingReason  `json:"reason"`
	Confidence       ConfidenceLevel `json:"confidence"`
	BaselineP95MS    float64         `json:"baseline_p95_ms"`
	MaxObservedRPS   int             `json:"max_observed_rps"`
	Notes            string          `json:"notes,omitempty"`
}
