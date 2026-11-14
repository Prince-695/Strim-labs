package notify_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/notify"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDispatcher_SlackDispatch(t *testing.T) {
	var receivedBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
		body, _ := io.ReadAll(r.Body)
		receivedBody = body
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	mockMailer := mailer.NewMockMailer()
	// Disable SSRF guard for localhost httptest server in unit test
	dispatcher := notify.NewDispatcher(mockMailer, nil, nil)

	channel := &domain.NotificationChannel{
		ID:        "ch-slack",
		Type:      domain.ChannelTypeSlack,
		Name:      "#critical-alerts",
		Config:    domain.JSONMap{"webhook_url": server.URL},
		Enabled:   true,
		CreatedAt: time.Now().UTC(),
	}

	rule := &domain.AlertRule{
		ID:       "rule-err",
		Name:     "High Error Rate",
		Severity: domain.AlertSeverityCritical,
	}

	incident := &domain.Incident{
		ID:             "inc-001",
		RuleID:         "rule-err",
		Status:         domain.IncidentStatusOpen,
		Severity:       domain.AlertSeverityCritical,
		Title:          "5xx Error Burst",
		Summary:        "Error rate reached 12.5%",
		CurrentValue:   12.5,
		ThresholdValue: 5.0,
	}

	err := dispatcher.Dispatch(context.Background(), channel, incident, rule, domain.IncidentEventOpened)
	require.NoError(t, err)

	var payload map[string]interface{}
	require.NoError(t, json.Unmarshal(receivedBody, &payload))
	assert.Contains(t, payload["text"], "[OPEN] High Error Rate")

	attachments, ok := payload["attachments"].([]interface{})
	require.True(t, ok)
	require.Len(t, attachments, 1)

	att := attachments[0].(map[string]interface{})
	assert.Equal(t, "#E01E5A", att["color"]) // Red for critical
}

func TestDispatcher_EmailDispatch(t *testing.T) {
	mockMailer := mailer.NewMockMailer()
	dispatcher := notify.NewDispatcher(mockMailer, nil, nil)

	channel := &domain.NotificationChannel{
		ID:   "ch-email",
		Type: domain.ChannelTypeEmail,
		Name: "Oncall Team",
		Config: domain.JSONMap{
			"addresses": []interface{}{"devops@acme.com", "lead@acme.com"},
		},
		Enabled: true,
	}

	incident := &domain.Incident{
		ID:             "inc-email",
		Title:          "Latency Spike",
		Status:         domain.IncidentStatusOpen,
		Severity:       domain.AlertSeverityWarning,
		CurrentValue:   350,
		ThresholdValue: 150,
		Summary:        "P95 reached 350ms",
	}

	err := dispatcher.Dispatch(context.Background(), channel, incident, nil, domain.IncidentEventOpened)
	require.NoError(t, err)

	sent := mockMailer.SentEmails()
	require.Len(t, sent, 2)
	assert.Equal(t, "devops@acme.com", sent[0].ToEmail)
	assert.Equal(t, "lead@acme.com", sent[1].ToEmail)
	assert.Contains(t, sent[0].Subject, "Latency Spike")
}

func TestDispatcher_WebhookWithHMAC(t *testing.T) {
	var receivedBody []byte
	var receivedSig string
	var receivedTS string

	secret := "whsec_supersecretkey12345"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		receivedBody = body
		receivedSig = r.Header.Get("X-Strim-Signature")
		receivedTS = r.Header.Get("X-Strim-Timestamp")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dispatcher := notify.NewDispatcher(nil, nil, nil)

	channel := &domain.NotificationChannel{
		ID:   "ch-webhook",
		Type: domain.ChannelTypeWebhook,
		Name: "Custom Integration",
		Config: domain.JSONMap{
			"url":    server.URL,
			"secret": secret,
		},
		Enabled: true,
	}

	incident := &domain.Incident{
		ID:       "inc-wh",
		Title:    "Custom Alert",
		Severity: domain.AlertSeverityInfo,
		Status:   domain.IncidentStatusResolved,
	}

	err := dispatcher.Dispatch(context.Background(), channel, incident, nil, domain.IncidentEventResolved)
	require.NoError(t, err)

	require.NotEmpty(t, receivedSig)
	require.NotEmpty(t, receivedTS)

	// Verify HMAC signature
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(receivedTS + "." + string(receivedBody)))
	expectedSig := "t=" + receivedTS + ",v1=" + hex.EncodeToString(mac.Sum(nil))

	assert.Equal(t, expectedSig, receivedSig)
}

func TestDispatcher_RetryOn5xxFailure(t *testing.T) {
	var callCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&callCount, 1)
		if count < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	dispatcher := notify.NewDispatcher(nil, nil, nil)

	channel := &domain.NotificationChannel{
		Type:    domain.ChannelTypeWebhook,
		Config:  domain.JSONMap{"url": server.URL},
		Enabled: true,
	}

	err := dispatcher.TestSend(context.Background(), channel)
	require.NoError(t, err)
	assert.Equal(t, int32(3), atomic.LoadInt32(&callCount))
}

func TestDispatcher_SSRFProtection(t *testing.T) {
	ssrfGuard := netguard.NewSSRFGuard(nil)
	dispatcher := notify.NewDispatcher(nil, ssrfGuard, nil)

	channel := &domain.NotificationChannel{
		Type:    domain.ChannelTypeWebhook,
		Config:  domain.JSONMap{"url": "http://127.0.0.1:8080/internal"},
		Enabled: true,
	}

	err := dispatcher.TestSend(context.Background(), channel)
	assert.Error(t, err)
	assert.Contains(t, strings.ToLower(err.Error()), "blocked")
}
