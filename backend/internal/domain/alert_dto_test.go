package domain_test

import (
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestAlertDTO_MaskChannelConfig(t *testing.T) {
	// Slack secret masking
	slackCfg := domain.JSONMap{
		"webhook_url": "https://hooks.slack.com/services/T000/B000/XXXX",
		"channel":     "#production-alerts",
	}
	maskedSlack := domain.MaskChannelConfig(domain.ChannelTypeSlack, slackCfg)
	assert.Equal(t, "***", maskedSlack["webhook_url"])
	assert.Equal(t, "#production-alerts", maskedSlack["channel"])

	// Webhook secret masking
	webhookCfg := domain.JSONMap{
		"url":    "https://api.external.com/webhooks",
		"secret": "super-secret-hmac-key",
	}
	maskedWebhook := domain.MaskChannelConfig(domain.ChannelTypeWebhook, webhookCfg)
	assert.Equal(t, "https://api.external.com/webhooks", maskedWebhook["url"])
	assert.Equal(t, "***", maskedWebhook["secret"])

	// Email config unmasked
	emailCfg := domain.JSONMap{
		"addresses": []interface{}{"devops@acme.com", "oncall@acme.com"},
	}
	maskedEmail := domain.MaskChannelConfig(domain.ChannelTypeEmail, emailCfg)
	assert.Equal(t, emailCfg["addresses"], maskedEmail["addresses"])
}

func TestAlertDTO_ToAlertRuleResponse(t *testing.T) {
	now := time.Now().UTC()
	rule := &domain.AlertRule{
		ID:          "rule-123",
		OrgID:       "org-123",
		ProjectID:   "proj-123",
		Name:        "High Error Rate",
		Description: "Triggers when 5xx errors exceed 5%",
		Enabled:     true,
		Version:     2,
		Scope: domain.JSONMap{
			"type": "project",
		},
		Condition: domain.JSONMap{
			"metric":    "error_rate",
			"operator":  ">",
			"threshold": 0.05,
			"window":    "5m",
			"for":       "2m",
		},
		Severity:   domain.AlertSeverityCritical,
		ChannelIDs: domain.ChannelIDsToJSONMap([]string{"ch-1", "ch-2"}),
		State:      domain.AlertStateFiring,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	resp := domain.ToAlertRuleResponse(rule)
	assert.Equal(t, "rule-123", resp.ID)
	assert.Equal(t, "High Error Rate", resp.Name)
	assert.Equal(t, 2, resp.Version)
	assert.Equal(t, domain.AlertScopeProject, resp.Scope.Type)
	assert.Equal(t, "error_rate", resp.Condition.Metric)
	assert.Equal(t, ">", resp.Condition.Operator)
	assert.Equal(t, 0.05, resp.Condition.Threshold)
	assert.Equal(t, []string{"ch-1", "ch-2"}, resp.ChannelIDs)
	assert.Equal(t, domain.AlertStateFiring, resp.State)
}

func TestAlertDTO_ToIncidentResponse(t *testing.T) {
	now := time.Now().UTC()
	inc := &domain.Incident{
		ID:             "inc-001",
		OrgID:          "org-1",
		ProjectID:      "proj-1",
		RuleID:         "rule-1",
		Status:         domain.IncidentStatusOpen,
		Severity:       domain.AlertSeverityWarning,
		Title:          "Elevated Latency",
		Summary:        "P95 reached 250ms (threshold 100ms)",
		CurrentValue:   250.0,
		ThresholdValue: 100.0,
		AutoResolved:   false,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	resp := domain.ToIncidentResponse(inc)
	assert.Equal(t, "inc-001", resp.ID)
	assert.Equal(t, domain.IncidentStatusOpen, resp.Status)
	assert.Equal(t, domain.AlertSeverityWarning, resp.Severity)
	assert.Equal(t, 250.0, resp.CurrentValue)
	assert.False(t, resp.AutoResolved)
}

func TestAlertDTO_ToChannelResponse(t *testing.T) {
	now := time.Now().UTC()
	ch := &domain.NotificationChannel{
		ID:        "ch-slack",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Type:      domain.ChannelTypeSlack,
		Name:      "#team-alerts",
		Config: domain.JSONMap{
			"webhook_url": "https://hooks.slack.com/services/T1/B1/K1",
		},
		Enabled:   true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	resp := domain.ToChannelResponse(ch)
	assert.Equal(t, "ch-slack", resp.ID)
	assert.Equal(t, domain.ChannelTypeSlack, resp.Type)
	assert.Equal(t, "***", resp.Config["webhook_url"])
}
