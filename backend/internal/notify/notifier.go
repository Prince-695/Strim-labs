package notify

import "context"

// ChannelType defines the alert notification dispatch target.
type ChannelType string

const (
	ChannelSlack   ChannelType = "slack"
	ChannelEmail   ChannelType = "email"
	ChannelWebhook ChannelType = "webhook"
)

// Notification represents an alert dispatch message.
type Notification struct {
	IncidentID string      `json:"incident_id"`
	RuleName   string      `json:"rule_name"`
	Severity   string      `json:"severity"`
	Message    string      `json:"message"`
	Channel    ChannelType `json:"channel"`
}

// Notifier defines the interface for outbound alert dispatchers.
type Notifier interface {
	Send(ctx context.Context, n Notification) error
}
