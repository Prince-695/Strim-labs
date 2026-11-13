package domain

import (
	"time"
)

// AlertState represents the state machine: ok -> pending -> firing -> resolved / muted.
type AlertState string

const (
	AlertStateOK       AlertState = "ok"
	AlertStatePending  AlertState = "pending"
	AlertStateFiring   AlertState = "firing"
	AlertStateMuted    AlertState = "muted"
	AlertStateResolved AlertState = "resolved"
)

// AlertSeverity levels.
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityInfo     AlertSeverity = "info"
)

// AlertScopeType defines the evaluation scope.
type AlertScopeType string

const (
	AlertScopeProject  AlertScopeType = "project"
	AlertScopeEndpoint AlertScopeType = "endpoint"
)

// AlertScope specifies whether an alert rule evaluates all endpoints or a specific endpoint.
type AlertScope struct {
	Type       AlertScopeType `json:"type"`
	EndpointID *string        `json:"endpoint_id,omitempty"`
}

// AlertCondition defines metric thresholds and evaluation windows.
type AlertCondition struct {
	Metric    string  `json:"metric"`   // "error_rate", "latency_p95", "latency_p99", "rps"
	Operator  string  `json:"operator"` // ">", ">=", "<", "<="
	Threshold float64 `json:"threshold"`
	Window    string  `json:"window"` // "1m", "5m", "15m", "1h"
	For       string  `json:"for"`    // "0m", "1m", "2m", "5m"
}

// AlertRule represents a configured alerting policy stored in the database.
type AlertRule struct {
	ID              string        `gorm:"primaryKey;size:36" json:"id"`
	OrgID           string        `gorm:"index;size:36;not null" json:"org_id"`
	ProjectID       string        `gorm:"index;size:36;not null" json:"project_id"`
	Name            string        `gorm:"size:128;not null" json:"name"`
	Description     string        `gorm:"size:512" json:"description"`
	Enabled         bool          `gorm:"default:true;not null" json:"enabled"`
	Version         int           `gorm:"default:1;not null" json:"version"`
	Scope           JSONMap       `gorm:"type:text" json:"scope"`
	Condition       JSONMap       `gorm:"type:text" json:"condition"`
	Severity        AlertSeverity `gorm:"size:32;not null" json:"severity"`
	ChannelIDs      JSONMap       `gorm:"type:text" json:"channel_ids"`
	State           AlertState    `gorm:"size:32;default:'ok';not null" json:"state"`
	PendingSince    *time.Time    `json:"pending_since,omitempty"`
	MutedUntil      *time.Time    `json:"muted_until,omitempty"`
	LastEvaluatedAt *time.Time    `json:"last_evaluated_at,omitempty"`
	LastTriggeredAt *time.Time    `json:"last_triggered_at,omitempty"`
	CreatedAt       time.Time     `gorm:"not null" json:"created_at"`
	UpdatedAt       time.Time     `gorm:"not null" json:"updated_at"`
}

// TableName returns table name for GORM.
func (AlertRule) TableName() string {
	return "alert_rules"
}

// IncidentStatus represents the resolution state of an opened incident.
type IncidentStatus string

const (
	IncidentStatusOpen         IncidentStatus = "open"
	IncidentStatusAcknowledged IncidentStatus = "acknowledged"
	IncidentStatusResolved     IncidentStatus = "resolved"
)

// IncidentEventType defines timeline audit milestones.
type IncidentEventType string

const (
	IncidentEventOpened       IncidentEventType = "opened"
	IncidentEventNotified     IncidentEventType = "notified"
	IncidentEventAcknowledged IncidentEventType = "acknowledged"
	IncidentEventComment      IncidentEventType = "comment"
	IncidentEventResolved     IncidentEventType = "resolved"
)

// Incident represents an actionable outage or performance degradation event.
type Incident struct {
	ID             string         `gorm:"primaryKey;size:36" json:"id"`
	OrgID          string         `gorm:"index;size:36;not null" json:"org_id"`
	ProjectID      string         `gorm:"index;size:36;not null" json:"project_id"`
	RuleID         string         `gorm:"index;size:36;not null" json:"rule_id"`
	Status         IncidentStatus `gorm:"size:32;default:'open';not null" json:"status"`
	Severity       AlertSeverity  `gorm:"size:32;not null" json:"severity"`
	Title          string         `gorm:"size:255;not null" json:"title"`
	Summary        string         `gorm:"type:text" json:"summary"`
	CurrentValue   float64        `json:"current_value"`
	ThresholdValue float64        `json:"threshold_value"`
	AcknowledgedAt *time.Time     `json:"acknowledged_at,omitempty"`
	AcknowledgedBy *string        `gorm:"size:36" json:"acknowledged_by,omitempty"`
	ResolvedAt     *time.Time     `json:"resolved_at,omitempty"`
	ResolvedBy     *string        `gorm:"size:36" json:"resolved_by,omitempty"`
	AutoResolved   bool           `gorm:"default:false;not null" json:"auto_resolved"`
	CreatedAt      time.Time      `gorm:"not null" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"not null" json:"updated_at"`
}

// TableName returns table name for GORM.
func (Incident) TableName() string {
	return "incidents"
}

// IncidentEvent records chronological history and comments on an incident.
type IncidentEvent struct {
	ID         string            `gorm:"primaryKey;size:36" json:"id"`
	IncidentID string            `gorm:"index;size:36;not null" json:"incident_id"`
	Type       IncidentEventType `gorm:"size:32;not null" json:"type"`
	Actor      string            `gorm:"size:128;not null" json:"actor"` // "system" or user email
	Detail     string            `gorm:"type:text" json:"detail"`
	At         time.Time         `gorm:"not null" json:"at"`
}

// TableName returns table name for GORM.
func (IncidentEvent) TableName() string {
	return "incident_events"
}

// ChannelType specifies supported outbound notification delivery methods.
type ChannelType string

const (
	ChannelTypeSlack   ChannelType = "slack"
	ChannelTypeEmail   ChannelType = "email"
	ChannelTypeWebhook ChannelType = "webhook"
)

// NotificationChannel represents an outbound alerting destination.
type NotificationChannel struct {
	ID        string      `gorm:"primaryKey;size:36" json:"id"`
	OrgID     string      `gorm:"index;size:36;not null" json:"org_id"`
	ProjectID string      `gorm:"index;size:36;not null" json:"project_id"`
	Type      ChannelType `gorm:"size:32;not null" json:"type"`
	Name      string      `gorm:"size:128;not null" json:"name"`
	Config    JSONMap     `gorm:"type:text" json:"config"`
	Enabled   bool        `gorm:"default:true;not null" json:"enabled"`
	CreatedAt time.Time   `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time   `gorm:"not null" json:"updated_at"`
}

// TableName returns table name for GORM.
func (NotificationChannel) TableName() string {
	return "notification_channels"
}

// NotificationLog stores dispatch attempt audit records and error diagnostics.
type NotificationLog struct {
	ID         string      `gorm:"primaryKey;size:36" json:"id"`
	ChannelID  string      `gorm:"index;size:36;not null" json:"channel_id"`
	IncidentID string      `gorm:"index;size:36;not null" json:"incident_id"`
	Type       ChannelType `gorm:"size:32;not null" json:"type"`
	Status     string      `gorm:"size:32;not null" json:"status"` // "success", "failed"
	Error      string      `gorm:"type:text" json:"error,omitempty"`
	Payload    JSONMap     `gorm:"type:text" json:"payload"`
	SentAt     time.Time   `gorm:"not null" json:"sent_at"`
}

// TableName returns table name for GORM.
func (NotificationLog) TableName() string {
	return "notification_logs"
}
