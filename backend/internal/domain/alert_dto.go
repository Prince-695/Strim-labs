package domain

import (
	"encoding/json"
	"strings"
	"time"
)

// CreateAlertRuleRequest payload for POST /alert-rules.
type CreateAlertRuleRequest struct {
	Name        string         `json:"name" validate:"required,min=2,max=128"`
	Description string         `json:"description" validate:"max=512"`
	Scope       AlertScope     `json:"scope" validate:"required"`
	Condition   AlertCondition `json:"condition" validate:"required"`
	Severity    AlertSeverity  `json:"severity" validate:"required,oneof=critical warning info"`
	ChannelIDs  []string       `json:"channel_ids"`
	Enabled     *bool          `json:"enabled,omitempty"`
}

// UpdateAlertRuleRequest payload for PUT /alert-rules/:ruleID with mandatory optimistic concurrency.
type UpdateAlertRuleRequest struct {
	Version     int             `json:"version" validate:"required,min=1"`
	Name        *string         `json:"name,omitempty" validate:"omitempty,min=2,max=128"`
	Description *string         `json:"description,omitempty" validate:"omitempty,max=512"`
	Scope       *AlertScope     `json:"scope,omitempty"`
	Condition   *AlertCondition `json:"condition,omitempty"`
	Severity    *AlertSeverity  `json:"severity,omitempty" validate:"omitempty,oneof=critical warning info"`
	ChannelIDs  *[]string       `json:"channel_ids,omitempty"`
	Enabled     *bool           `json:"enabled,omitempty"`
}

// MuteAlertRuleRequest payload for POST /alert-rules/:ruleID/mute.
type MuteAlertRuleRequest struct {
	Minutes int `json:"minutes" validate:"required,min=1,max=10080"`
}

// AlertRuleResponse payload for single alert rule.
type AlertRuleResponse struct {
	ID              string         `json:"id"`
	OrgID           string         `json:"org_id"`
	ProjectID       string         `json:"project_id"`
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	Enabled         bool           `json:"enabled"`
	Version         int            `json:"version"`
	Scope           AlertScope     `json:"scope"`
	Condition       AlertCondition `json:"condition"`
	Severity        AlertSeverity  `json:"severity"`
	ChannelIDs      []string       `json:"channel_ids"`
	State           AlertState     `json:"state"`
	PendingSince    *time.Time     `json:"pending_since,omitempty"`
	MutedUntil      *time.Time     `json:"muted_until,omitempty"`
	LastEvaluatedAt *time.Time     `json:"last_evaluated_at,omitempty"`
	LastTriggeredAt *time.Time     `json:"last_triggered_at,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

// ListAlertRulesResponse payload for GET /alert-rules.
type ListAlertRulesResponse struct {
	Rules []AlertRuleResponse `json:"rules"`
	Total int                 `json:"total"`
}

// ListIncidentsQuery specifies filters for querying incidents.
type ListIncidentsQuery struct {
	Status   string `json:"status"`   // "open", "acknowledged", "resolved", "all"
	Severity string `json:"severity"` // "critical", "warning", "info"
	Range    string `json:"range"`    // "15m", "1h", "6h", "24h", "7d", "30d"
	Limit    int    `json:"limit"`
	Offset   int    `json:"offset"`
}

// IncidentResponse payload for an incident.
type IncidentResponse struct {
	ID             string         `json:"id"`
	OrgID          string         `json:"org_id"`
	ProjectID      string         `json:"project_id"`
	RuleID         string         `json:"rule_id"`
	Status         IncidentStatus `json:"status"`
	Severity       AlertSeverity  `json:"severity"`
	Title          string         `json:"title"`
	Summary        string         `json:"summary"`
	CurrentValue   float64        `json:"current_value"`
	ThresholdValue float64        `json:"threshold_value"`
	AcknowledgedAt *time.Time     `json:"acknowledged_at,omitempty"`
	AcknowledgedBy *string        `json:"acknowledged_by,omitempty"`
	ResolvedAt     *time.Time     `json:"resolved_at,omitempty"`
	ResolvedBy     *string        `json:"resolved_by,omitempty"`
	AutoResolved   bool           `json:"auto_resolved"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// IncidentTimelineItem represents a chronological entry in an incident's life cycle.
type IncidentTimelineItem struct {
	ID     string            `json:"id"`
	Type   IncidentEventType `json:"type"`
	Actor  string            `json:"actor"`
	Detail string            `json:"detail"`
	At     time.Time         `json:"at"`
}

// IncidentDetailResponse payload for GET /incidents/:incidentID including timeline.
type IncidentDetailResponse struct {
	IncidentResponse
	Timeline []IncidentTimelineItem `json:"timeline"`
}

// ListIncidentsResponse payload for GET /incidents.
type ListIncidentsResponse struct {
	Incidents []IncidentResponse `json:"incidents"`
	Total     int                `json:"total"`
}

// AddIncidentCommentRequest payload for POST /incidents/:incidentID/comments.
type AddIncidentCommentRequest struct {
	Body string `json:"body" validate:"required,min=1,max=2000"`
}

// CreateChannelRequest payload for POST /notification-channels.
type CreateChannelRequest struct {
	Type   ChannelType `json:"type" validate:"required,oneof=slack email webhook"`
	Name   string      `json:"name" validate:"required,min=2,max=128"`
	Config JSONMap     `json:"config" validate:"required"`
}

// UpdateChannelRequest payload for PUT /notification-channels/:channelID.
type UpdateChannelRequest struct {
	Name    *string  `json:"name,omitempty" validate:"omitempty,min=2,max=128"`
	Config  *JSONMap `json:"config,omitempty"`
	Enabled *bool    `json:"enabled,omitempty"`
}

// ChannelResponse payload for a notification channel.
type ChannelResponse struct {
	ID        string      `json:"id"`
	OrgID     string      `json:"org_id"`
	ProjectID string      `json:"project_id"`
	Type      ChannelType `json:"type"`
	Name      string      `json:"name"`
	Config    JSONMap     `json:"config"`
	Enabled   bool        `json:"enabled"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// ListChannelsResponse payload for GET /notification-channels.
type ListChannelsResponse struct {
	Channels []ChannelResponse `json:"channels"`
	Total    int               `json:"total"`
}

// TestChannelResponse payload for POST /notification-channels/:channelID/test.
type TestChannelResponse struct {
	Success bool    `json:"success"`
	Message string  `json:"message"`
	Details JSONMap `json:"details,omitempty"`
}

// MaskChannelConfig ensures secrets (such as webhook URLs and HMAC signing secrets) are masked on API responses.
func MaskChannelConfig(chType ChannelType, cfg JSONMap) JSONMap {
	masked := make(JSONMap)
	for k, v := range cfg {
		masked[k] = v
	}

	switch chType {
	case ChannelTypeSlack:
		if url, ok := masked["webhook_url"].(string); ok && url != "" {
			masked["webhook_url"] = "***"
		}
	case ChannelTypeWebhook:
		if sec, ok := masked["secret"].(string); ok && sec != "" {
			masked["secret"] = "***"
		}
	}
	return masked
}

// ToAlertRuleResponse converts domain.AlertRule to AlertRuleResponse.
func ToAlertRuleResponse(rule *AlertRule) AlertRuleResponse {
	var scope AlertScope
	if len(rule.Scope) > 0 {
		b, _ := json.Marshal(rule.Scope)
		_ = json.Unmarshal(b, &scope)
	}
	if scope.Type == "" {
		scope.Type = AlertScopeProject
	}

	var condition AlertCondition
	if len(rule.Condition) > 0 {
		b, _ := json.Marshal(rule.Condition)
		_ = json.Unmarshal(b, &condition)
	}

	channelIDs := []string{}
	if len(rule.ChannelIDs) > 0 {
		if rawItems, ok := rule.ChannelIDs["items"].([]interface{}); ok {
			for _, item := range rawItems {
				if s, ok := item.(string); ok {
					channelIDs = append(channelIDs, s)
				}
			}
		}
	}

	return AlertRuleResponse{
		ID:              rule.ID,
		OrgID:           rule.OrgID,
		ProjectID:       rule.ProjectID,
		Name:            rule.Name,
		Description:     rule.Description,
		Enabled:         rule.Enabled,
		Version:         rule.Version,
		Scope:           scope,
		Condition:       condition,
		Severity:        rule.Severity,
		ChannelIDs:      channelIDs,
		State:           rule.State,
		PendingSince:    rule.PendingSince,
		MutedUntil:      rule.MutedUntil,
		LastEvaluatedAt: rule.LastEvaluatedAt,
		LastTriggeredAt: rule.LastTriggeredAt,
		CreatedAt:       rule.CreatedAt,
		UpdatedAt:       rule.UpdatedAt,
	}
}

// ChannelIDsToJSONMap encodes a slice of channel IDs into JSONMap wrapper.
func ChannelIDsToJSONMap(ids []string) JSONMap {
	m := make(JSONMap)
	items := make([]interface{}, len(ids))
	for i, id := range ids {
		items[i] = strings.TrimSpace(id)
	}
	m["items"] = items
	return m
}

// ToIncidentResponse converts domain.Incident to IncidentResponse.
func ToIncidentResponse(inc *Incident) IncidentResponse {
	return IncidentResponse{
		ID:             inc.ID,
		OrgID:          inc.OrgID,
		ProjectID:      inc.ProjectID,
		RuleID:         inc.RuleID,
		Status:         inc.Status,
		Severity:       inc.Severity,
		Title:          inc.Title,
		Summary:        inc.Summary,
		CurrentValue:   inc.CurrentValue,
		ThresholdValue: inc.ThresholdValue,
		AcknowledgedAt: inc.AcknowledgedAt,
		AcknowledgedBy: inc.AcknowledgedBy,
		ResolvedAt:     inc.ResolvedAt,
		ResolvedBy:     inc.ResolvedBy,
		AutoResolved:   inc.AutoResolved,
		CreatedAt:      inc.CreatedAt,
		UpdatedAt:      inc.UpdatedAt,
	}
}

// ToChannelResponse converts domain.NotificationChannel to ChannelResponse with masked secrets.
func ToChannelResponse(ch *NotificationChannel) ChannelResponse {
	return ChannelResponse{
		ID:        ch.ID,
		OrgID:     ch.OrgID,
		ProjectID: ch.ProjectID,
		Type:      ch.Type,
		Name:      ch.Name,
		Config:    MaskChannelConfig(ch.Type, ch.Config),
		Enabled:   ch.Enabled,
		CreatedAt: ch.CreatedAt,
		UpdatedAt: ch.UpdatedAt,
	}
}
