package notify

import (
	"context"

	"github.com/Prince-695/strim/backend/internal/domain"
)

// ChannelType defines the alert notification dispatch target.
type ChannelType = domain.ChannelType

const (
	ChannelSlack   = domain.ChannelTypeSlack
	ChannelEmail   = domain.ChannelTypeEmail
	ChannelWebhook = domain.ChannelTypeWebhook
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
