package mailer

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMockMailer_AllMethods(t *testing.T) {
	ctx := context.Background()
	m := NewMockMailer()

	// 1. SendVerificationOTP
	err := m.SendVerificationOTP(ctx, "dev@strimlabs.dev", "Alex", "123456")
	require.NoError(t, err)
	assert.Equal(t, 1, len(m.SentEmails()))
	last := m.LastEmail()
	require.NotNil(t, last)
	assert.Equal(t, "dev@strimlabs.dev", last.ToEmail)
	assert.Equal(t, "Alex", last.FirstName)
	assert.Equal(t, "123456", last.OTP)
	assert.Equal(t, "email_verification", last.Purpose)

	// 2. SendPasswordResetOTP
	err = m.SendPasswordResetOTP(ctx, "dev@strimlabs.dev", "Alex", "654321")
	require.NoError(t, err)
	assert.Equal(t, 2, len(m.SentEmails()))
	last = m.LastEmail()
	assert.Equal(t, "password_reset", last.Purpose)
	assert.Equal(t, "654321", last.OTP)

	// 3. SendAlertNotification
	err = m.SendAlertNotification(ctx, "oncall@strimlabs.dev", "[FIRING] High Latency", "Incident details")
	require.NoError(t, err)
	assert.Equal(t, 3, len(m.SentEmails()))
	last = m.LastEmail()
	assert.Equal(t, "alert_notification", last.Purpose)
	assert.Equal(t, "[FIRING] High Latency", last.Subject)

	// 4. SendWelcomeEmail
	err = m.SendWelcomeEmail(ctx, "dev@strimlabs.dev", "Alex")
	require.NoError(t, err)
	assert.Equal(t, 4, len(m.SentEmails()))
	last = m.LastEmail()
	assert.Equal(t, "welcome_onboarding", last.Purpose)
	assert.Equal(t, "Welcome to STRIM Labs! 🚀", last.Subject)

	// 5. Reset
	m.Reset()
	assert.Equal(t, 0, len(m.SentEmails()))
	assert.Nil(t, m.LastEmail())
}

func TestConsoleMailer_AllMethods(t *testing.T) {
	ctx := context.Background()
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cm := NewConsoleMailer(logger)

	require.NoError(t, cm.SendVerificationOTP(ctx, "user@test.com", "John", "111222"))
	require.NoError(t, cm.SendPasswordResetOTP(ctx, "user@test.com", "John", "333444"))
	require.NoError(t, cm.SendAlertNotification(ctx, "ops@test.com", "Test Alert", "Alert body"))
	require.NoError(t, cm.SendWelcomeEmail(ctx, "user@test.com", "John"))
}
