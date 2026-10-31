package alerts

// AlertState represents the state machine: ok -> pending -> firing -> resolved
type AlertState string

const (
	StateOK       AlertState = "ok"
	StatePending  AlertState = "pending"
	StateFiring   AlertState = "firing"
	StateResolved AlertState = "resolved"
)

// AlertRule defines metric threshold rules.
type AlertRule struct {
	ID        string     `json:"id"`
	ProjectID string     `json:"project_id"`
	Metric    string     `json:"metric"`   // rps, latency_p95, error_rate
	Operator  string     `json:"operator"` // gt, lt, gte, lte
	Threshold float64    `json:"threshold"`
	WindowSec int        `json:"window_seconds"`
	State     AlertState `json:"state"`
}
