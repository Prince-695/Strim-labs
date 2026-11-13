package alerts

import "github.com/Prince-695/strim/backend/internal/domain"

// AlertState represents the state machine: ok -> pending -> firing -> resolved / muted.
type AlertState = domain.AlertState

const (
	StateOK       = domain.AlertStateOK
	StatePending  = domain.AlertStatePending
	StateFiring   = domain.AlertStateFiring
	StateMuted    = domain.AlertStateMuted
	StateResolved = domain.AlertStateResolved
)

// AlertRule defines metric threshold rules.
type AlertRule = domain.AlertRule
