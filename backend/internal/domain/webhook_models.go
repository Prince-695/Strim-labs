package domain

import (
	"time"
)

// WebhookEventType identifies system events eligible for outbound webhook subscription.
type WebhookEventType string

const (
	EventTestStarted      WebhookEventType = "test.started"
	EventTestCompleted    WebhookEventType = "test.completed"
	EventTestFailed       WebhookEventType = "test.failed"
	EventTestStopped      WebhookEventType = "test.stopped"
	EventIncidentOpened   WebhookEventType = "incident.opened"
	EventIncidentAcked    WebhookEventType = "incident.acknowledged"
	EventIncidentResolved WebhookEventType = "incident.resolved"
	EventEndpointFound    WebhookEventType = "endpoint.discovered"
	EventProjectVerified  WebhookEventType = "verification.verified"
)

// AllWebhookEvents lists all valid webhook event types.
var AllWebhookEvents = []WebhookEventType{
	EventTestStarted,
	EventTestCompleted,
	EventTestFailed,
	EventTestStopped,
	EventIncidentOpened,
	EventIncidentAcked,
	EventIncidentResolved,
	EventEndpointFound,
	EventProjectVerified,
}

// Webhook represents a project-level outbound webhook subscription.
type Webhook struct {
	ID        string      `gorm:"primaryKey;size:36" json:"id"`
	ProjectID string      `gorm:"size:36;not null;index" json:"project_id"`
	OrgID     string      `gorm:"size:36;not null;index" json:"org_id"`
	URL       string      `gorm:"size:500;not null" json:"url"`
	Secret    string      `gorm:"size:128;not null" json:"-"` // Write-only / masked as "***"
	Events    StringArray `gorm:"type:text;not null" json:"events"`
	Active    bool        `gorm:"not null;default:true" json:"active"`
	CreatedAt time.Time   `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time   `gorm:"not null" json:"updated_at"`
}

// TableName returns GORM table name for Webhook.
func (Webhook) TableName() string {
	return "webhooks"
}

// MatchesEvent returns true if the webhook is active and subscribed to the event type.
func (w *Webhook) MatchesEvent(event WebhookEventType) bool {
	if !w.Active {
		return false
	}
	for _, e := range w.Events {
		if WebhookEventType(e) == event || e == "*" {
			return true
		}
	}
	return false
}

// WebhookDelivery records an outbound HTTP delivery attempt and outcome.
type WebhookDelivery struct {
	ID              string           `gorm:"primaryKey;size:36" json:"id"`
	WebhookID       string           `gorm:"size:36;not null;index" json:"webhook_id"`
	ProjectID       string           `gorm:"size:36;not null;index" json:"project_id"`
	OrgID           string           `gorm:"size:36;not null;index" json:"org_id"`
	Event           WebhookEventType `gorm:"size:50;not null;index" json:"event"`
	Status          string           `gorm:"size:20;not null;index" json:"status"` // "pending", "success", "failed"
	StatusCode      int              `json:"status_code"`
	RequestPayload  string           `gorm:"type:text" json:"request_payload"`
	ResponsePayload string           `gorm:"type:text" json:"response_payload"`
	DurationMs      int64            `json:"duration_ms"`
	Attempts        int              `gorm:"not null;default:1" json:"attempts"`
	NextRetryAt     *time.Time       `json:"next_retry_at,omitempty"`
	CreatedAt       time.Time        `gorm:"not null;index" json:"created_at"`
}

// TableName returns GORM table name for WebhookDelivery.
func (WebhookDelivery) TableName() string {
	return "webhook_deliveries"
}
