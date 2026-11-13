package domain

import (
	"encoding/json"
	"time"
)

// AuditActor represents identity summary of the user who performed an action.
type AuditActor struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// AuditLogResponse represents an audit trail entry.
type AuditLogResponse struct {
	ID           string                 `json:"id"`
	At           time.Time              `json:"at"`
	Actor        AuditActor             `json:"actor"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id"`
	IP           string                 `json:"ip"`
	UserAgent    string                 `json:"user_agent"`
	Changes      map[string]interface{} `json:"changes,omitempty"`
}

// ToAuditLogResponse converts AuditLog model to public response DTO.
func ToAuditLogResponse(l *AuditLog) AuditLogResponse {
	var changes map[string]interface{}
	if l.Changes != "" {
		_ = json.Unmarshal([]byte(l.Changes), &changes)
	}

	return AuditLogResponse{
		ID: l.ID,
		At: l.At,
		Actor: AuditActor{
			ID:    l.ActorID,
			Email: l.ActorEmail,
		},
		Action:       l.Action,
		ResourceType: l.ResourceType,
		ResourceID:   l.ResourceID,
		IP:           l.IP,
		UserAgent:    l.UserAgent,
		Changes:      changes,
	}
}

// AuditLogFilter provides query parameters for filtering audit logs.
type AuditLogFilter struct {
	OrgID        string
	ActorID      string
	Action       string
	ResourceType string
	From         *time.Time
	To           *time.Time
	Limit        int
	Cursor       string
}
