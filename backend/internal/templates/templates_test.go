package templates

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRenderVerificationOTP(t *testing.T) {
	t.Run("Standard rendering with name", func(t *testing.T) {
		html, err := RenderVerificationOTP(VerificationData{
			FirstName:     "Alex",
			OTP:           "849201",
			ExpiryMinutes: 10,
		})
		require.NoError(t, err)
		assert.Contains(t, html, "Alex")
		assert.Contains(t, html, "849201")
		assert.Contains(t, html, "10 minutes")
		assert.Contains(t, html, "STRIM LABS")
	})

	t.Run("Default fallback for empty name and zero expiry", func(t *testing.T) {
		html, err := RenderVerificationOTP(VerificationData{
			FirstName:     "",
			OTP:           "123456",
			ExpiryMinutes: 0,
		})
		require.NoError(t, err)
		assert.Contains(t, html, "there")
		assert.Contains(t, html, "123456")
		assert.Contains(t, html, "10 minutes")
	})

	t.Run("HTML escaping to prevent XSS", func(t *testing.T) {
		html, err := RenderVerificationOTP(VerificationData{
			FirstName:     "<script>alert(1)</script>",
			OTP:           "654321",
			ExpiryMinutes: 10,
		})
		require.NoError(t, err)
		assert.NotContains(t, html, "<script>")
		assert.Contains(t, html, "&lt;script&gt;")
	})
}

func TestRenderPasswordResetOTP(t *testing.T) {
	t.Run("Standard password reset", func(t *testing.T) {
		html, err := RenderPasswordResetOTP(PasswordResetData{
			FirstName:     "Satoshi",
			OTP:           "998877",
			ExpiryMinutes: 15,
		})
		require.NoError(t, err)
		assert.Contains(t, html, "Satoshi")
		assert.Contains(t, html, "998877")
		assert.Contains(t, html, "15 minutes")
		assert.Contains(t, html, "Reset your password")
		assert.Contains(t, html, "Didn't request this change?")
	})
}

func TestRenderWelcome(t *testing.T) {
	t.Run("Welcome email after sign in", func(t *testing.T) {
		html, err := RenderWelcome(WelcomeData{
			FirstName:    "Elena",
			DashboardURL: "https://strim-labs.com/dashboard",
		})
		require.NoError(t, err)
		assert.Contains(t, html, "Elena")
		assert.Contains(t, html, "Welcome to STRIM Labs! 🚀")
		assert.Contains(t, html, "Launch Your Dashboard")
		assert.Contains(t, html, "https://strim-labs.com/dashboard")
		assert.Contains(t, html, "Real-Time API Ingestion &amp; Observability")
		assert.Contains(t, html, "High-Concurrency Synthetic Load Testing")
	})

	t.Run("Welcome email fallback without name", func(t *testing.T) {
		html, err := RenderWelcome(WelcomeData{
			FirstName:    "",
			DashboardURL: "",
		})
		require.NoError(t, err)
		assert.Contains(t, html, "there")
		assert.Contains(t, html, "https://strim-labs.com")
	})
}

func TestRenderAlertNotification(t *testing.T) {
	t.Run("Critical Alert Rendering", func(t *testing.T) {
		html, err := RenderAlertNotification(AlertData{
			Subject:        "[FIRING] Latency Spike: p99 > 500ms",
			Title:          "Critical Latency Breach on /api/v1/checkout",
			Summary:        "Endpoint p99 latency exceeded threshold for 5 consecutive minutes.",
			IncidentID:     "inc-908123",
			RuleName:       "Checkout SLA Breach",
			Status:         "FIRING",
			Severity:       "critical",
			MetricValue:    "1240.50ms",
			ThresholdValue: "500.00ms",
			Timestamp:      "2026-11-16T14:00:00Z",
			DashboardURL:   "https://strim-labs.com/incidents/inc-908123",
		})
		require.NoError(t, err)
		assert.Contains(t, html, "CRITICAL ALERT")
		assert.Contains(t, html, "inc-908123")
		assert.Contains(t, html, "1240.50ms")
		assert.Contains(t, html, "500.00ms")
		assert.Contains(t, html, "https://strim-labs.com/incidents/inc-908123")
	})

	t.Run("Resolved Alert Rendering", func(t *testing.T) {
		html, err := RenderAlertNotification(AlertData{
			Subject:      "[RESOLVED] Latency Spike: p99 > 500ms",
			Title:        "Latency Spike Resolved",
			Status:       "RESOLVED",
			Severity:     "info",
			IncidentID:   "inc-908123",
			DashboardURL: "https://strim-labs.com/incidents/inc-908123",
		})
		require.NoError(t, err)
		assert.Contains(t, html, "RESOLVED")
		assert.Contains(t, html, "#10b981")
	})

	t.Run("ParseAndRenderAlert with structured body", func(t *testing.T) {
		subject := "[FIRING] High Error Rate: 5xx Spike"
		body := strings.Join([]string{
			"Incident ID: inc-test-456",
			"Status: OPEN",
			"Severity: critical",
			"Event: incident.opened",
			"Metric Value: 12.50% (Threshold: 5.00%)",
			"Summary: 5xx error rate exceeded 5%",
			"Time: 2026-11-16T14:30:00Z",
		}, "\n")

		html, err := ParseAndRenderAlert(subject, body, "https://strim-labs.com/incidents/inc-test-456")
		require.NoError(t, err)
		assert.Contains(t, html, "inc-test-456")
		assert.Contains(t, html, "5xx error rate exceeded 5%")
		assert.Contains(t, html, "CRITICAL ALERT")
	})
}
