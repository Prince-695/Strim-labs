package domain

import (
	"time"
)

// AuditLog represents an immutable, append-only record of a sensitive operation.
type AuditLog struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	OrgID        string    `gorm:"size:36;not null;index" json:"org_id"`
	At           time.Time `gorm:"not null;index" json:"at"`
	ActorID      string    `gorm:"size:36;not null;index" json:"actor_id"`
	ActorEmail   string    `gorm:"size:255;not null" json:"actor_email"`
	Action       string    `gorm:"size:100;not null;index" json:"action"`
	ResourceType string    `gorm:"size:50;not null;index" json:"resource_type"`
	ResourceID   string    `gorm:"size:36;not null;index" json:"resource_id"`
	IP           string    `gorm:"size:45;not null" json:"ip"`
	UserAgent    string    `gorm:"size:500;not null" json:"user_agent"`
	Changes      string    `gorm:"type:text" json:"changes"` // JSON string representation of before/after
}

// TableName returns GORM table name for AuditLog.
func (AuditLog) TableName() string {
	return "audit_logs"
}
