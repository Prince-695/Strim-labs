package notify

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
)

// Dispatcher coordinates multi-channel alert and incident notification dispatches.
type Dispatcher interface {
	Dispatch(ctx context.Context, channel *domain.NotificationChannel, incident *domain.Incident, rule *domain.AlertRule, eventType domain.IncidentEventType) error
	TestSend(ctx context.Context, channel *domain.NotificationChannel) error
}

type HTTPDispatcher struct {
	client    *http.Client
	mailer    mailer.Mailer
	ssrfGuard *netguard.SSRFGuard
	logger    *slog.Logger
}

// NewDispatcher creates a production-grade Dispatcher with SSRF guard and mailer support.
func NewDispatcher(mailer mailer.Mailer, ssrfGuard *netguard.SSRFGuard, logger *slog.Logger) *HTTPDispatcher {
	if logger == nil {
		logger = slog.Default()
	}
	return &HTTPDispatcher{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		mailer:    mailer,
		ssrfGuard: ssrfGuard,
		logger:    logger,
	}
}

// Dispatch delivers an incident event notification to the target channel.
func (d *HTTPDispatcher) Dispatch(ctx context.Context, channel *domain.NotificationChannel, incident *domain.Incident, rule *domain.AlertRule, eventType domain.IncidentEventType) error {
	if channel == nil || !channel.Enabled {
		return nil
	}

	switch channel.Type {
	case domain.ChannelTypeSlack:
		return d.dispatchSlack(ctx, channel, incident, rule, eventType)
	case domain.ChannelTypeEmail:
		return d.dispatchEmail(ctx, channel, incident, rule, eventType)
	case domain.ChannelTypeWebhook:
		return d.dispatchWebhook(ctx, channel, incident, rule, eventType)
	default:
		return fmt.Errorf("unsupported notification channel type: %s", channel.Type)
	}
}

// TestSend dispatches a synthetic verification message to validate channel configuration.
func (d *HTTPDispatcher) TestSend(ctx context.Context, channel *domain.NotificationChannel) error {
	if channel == nil {
		return fmt.Errorf("channel cannot be nil")
	}

	now := time.Now().UTC()
	dummyRule := &domain.AlertRule{
		ID:        "rule-test",
		Name:      "Test Alert Rule",
		Severity:  domain.AlertSeverityInfo,
		State:     domain.AlertStateFiring,
		CreatedAt: now,
	}
	dummyIncident := &domain.Incident{
		ID:             "inc-test",
		RuleID:         "rule-test",
		Status:         domain.IncidentStatusOpen,
		Severity:       domain.AlertSeverityInfo,
		Title:          fmt.Sprintf("STRIM Labs Test Alert for Channel: %s", channel.Name),
		Summary:        "This is an automated test message confirming that your alerting channel is correctly configured.",
		CurrentValue:   100.0,
		ThresholdValue: 50.0,
		CreatedAt:      now,
	}

	return d.Dispatch(ctx, channel, dummyIncident, dummyRule, domain.IncidentEventNotified)
}

func (d *HTTPDispatcher) dispatchSlack(ctx context.Context, channel *domain.NotificationChannel, incident *domain.Incident, rule *domain.AlertRule, eventType domain.IncidentEventType) error {
	rawURL, ok := channel.Config["webhook_url"].(string)
	if !ok || strings.TrimSpace(rawURL) == "" {
		return fmt.Errorf("slack channel missing webhook_url in config")
	}

	if d.ssrfGuard != nil {
		if _, err := d.ssrfGuard.ValidateTargetURL(ctx, rawURL); err != nil {
			return fmt.Errorf("slack webhook URL blocked by SSRF guard: %w", err)
		}
	}

	color := "#2EB886" // Green (info/resolved)
	if eventType != domain.IncidentEventResolved {
		switch incident.Severity {
		case domain.AlertSeverityCritical:
			color = "#E01E5A" // Red
		case domain.AlertSeverityWarning:
			color = "#ECB22E" // Yellow
		}
	}

	statusText := string(incident.Status)
	if eventType == domain.IncidentEventResolved {
		statusText = "RESOLVED"
	}

	ruleName := "Unknown Rule"
	if rule != nil {
		ruleName = rule.Name
	}

	payload := map[string]interface{}{
		"text": fmt.Sprintf("[%s] %s - %s", strings.ToUpper(statusText), ruleName, incident.Title),
		"attachments": []map[string]interface{}{
			{
				"color": color,
				"title": fmt.Sprintf("Incident: %s", incident.Title),
				"text":  incident.Summary,
				"fields": []map[string]interface{}{
					{"title": "Severity", "value": string(incident.Severity), "short": true},
					{"title": "Status", "value": statusText, "short": true},
					{"title": "Current Value", "value": fmt.Sprintf("%.2f", incident.CurrentValue), "short": true},
					{"title": "Threshold", "value": fmt.Sprintf("%.2f", incident.ThresholdValue), "short": true},
					{"title": "Incident ID", "value": incident.ID, "short": true},
					{"title": "Event", "value": string(eventType), "short": true},
				},
				"ts": time.Now().Unix(),
			},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return d.sendHTTPWithRetry(ctx, rawURL, "application/json", bodyBytes, nil)
}

func (d *HTTPDispatcher) dispatchEmail(ctx context.Context, channel *domain.NotificationChannel, incident *domain.Incident, rule *domain.AlertRule, eventType domain.IncidentEventType) error {
	if d.mailer == nil {
		return fmt.Errorf("mailer not configured on dispatcher")
	}

	rawAddresses, ok := channel.Config["addresses"].([]interface{})
	if !ok || len(rawAddresses) == 0 {
		return fmt.Errorf("email channel missing addresses in config")
	}

	statusText := string(incident.Status)
	if eventType == domain.IncidentEventResolved {
		statusText = "RESOLVED"
	}

	ruleName := "Alert"
	if rule != nil {
		ruleName = rule.Name
	}

	subject := fmt.Sprintf("[%s] %s: %s", strings.ToUpper(statusText), ruleName, incident.Title)
	body := fmt.Sprintf(
		"Incident ID: %s\nStatus: %s\nSeverity: %s\nEvent: %s\nMetric Value: %.2f (Threshold: %.2f)\nSummary: %s\nTime: %s",
		incident.ID,
		statusText,
		incident.Severity,
		eventType,
		incident.CurrentValue,
		incident.ThresholdValue,
		incident.Summary,
		time.Now().UTC().Format(time.RFC3339),
	)

	for _, addrItem := range rawAddresses {
		if addr, ok := addrItem.(string); ok && strings.TrimSpace(addr) != "" {
			if err := d.mailer.SendAlertNotification(ctx, addr, subject, body); err != nil {
				d.logger.ErrorContext(ctx, "Failed to send alert email", slog.String("to", addr), slog.Any("error", err))
				return err
			}
		}
	}

	return nil
}

func (d *HTTPDispatcher) dispatchWebhook(ctx context.Context, channel *domain.NotificationChannel, incident *domain.Incident, rule *domain.AlertRule, eventType domain.IncidentEventType) error {
	targetURL, ok := channel.Config["url"].(string)
	if !ok || strings.TrimSpace(targetURL) == "" {
		return fmt.Errorf("webhook channel missing url in config")
	}

	if d.ssrfGuard != nil {
		if _, err := d.ssrfGuard.ValidateTargetURL(ctx, targetURL); err != nil {
			return fmt.Errorf("webhook URL blocked by SSRF guard: %w", err)
		}
	}

	now := time.Now().UTC()
	payload := map[string]interface{}{
		"event":     string(eventType),
		"incident":  incident,
		"rule":      rule,
		"timestamp": now.Unix(),
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	headers := make(map[string]string)
	headers["Content-Type"] = "application/json"
	headers["X-Strim-Event"] = string(eventType)

	// HMAC-SHA256 signature if secret is configured
	if secret, ok := channel.Config["secret"].(string); ok && strings.TrimSpace(secret) != "" {
		tsStr := strconv.FormatInt(now.Unix(), 10)
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(tsStr + "." + string(bodyBytes)))
		sigHex := hex.EncodeToString(mac.Sum(nil))

		headers["X-Strim-Timestamp"] = tsStr
		headers["X-Strim-Signature"] = fmt.Sprintf("t=%s,v1=%s", tsStr, sigHex)
	}

	return d.sendHTTPWithRetry(ctx, targetURL, "application/json", bodyBytes, headers)
}

func (d *HTTPDispatcher) sendHTTPWithRetry(ctx context.Context, targetURL, contentType string, bodyBytes []byte, extraHeaders map[string]string) error {
	const maxRetries = 3
	backoff := 50 * time.Millisecond

	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return fmt.Errorf("failed to create http request: %w", err)
		}

		req.Header.Set("Content-Type", contentType)
		for k, v := range extraHeaders {
			req.Header.Set(k, v)
		}

		resp, err := d.client.Do(req)
		if err != nil {
			lastErr = err
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
				backoff *= 2
				continue
			}
		}

		// Read and close body
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil
		}

		// Non-retryable client error
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			return fmt.Errorf("outbound webhook rejected with HTTP %d", resp.StatusCode)
		}

		lastErr = fmt.Errorf("outbound webhook failed with HTTP %d", resp.StatusCode)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
			backoff *= 2
		}
	}

	return lastErr
}
