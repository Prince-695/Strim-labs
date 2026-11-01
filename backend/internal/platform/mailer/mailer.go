package mailer

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
)

// Mailer defines transactional email sending capabilities.
type Mailer interface {
	SendVerificationOTP(ctx context.Context, toEmail, firstName, otp string) error
	SendPasswordResetOTP(ctx context.Context, toEmail, firstName, otp string) error
}

// ConsoleMailer prints transactional emails to structured logger / standard output.
type ConsoleMailer struct {
	logger *slog.Logger
}

// NewConsoleMailer returns a Mailer implementation for local development and environments without external SMTP.
func NewConsoleMailer(logger *slog.Logger) *ConsoleMailer {
	return &ConsoleMailer{logger: logger}
}

func (c *ConsoleMailer) SendVerificationOTP(ctx context.Context, toEmail, firstName, otp string) error {
	c.logger.InfoContext(ctx, fmt.Sprintf("[MAILER] Email Verification OTP for %s (%s): %s (Valid for 10 minutes)", firstName, toEmail, otp),
		slog.String("to", toEmail),
		slog.String("otp", otp),
		slog.String("purpose", "email_verification"),
	)
	return nil
}

func (c *ConsoleMailer) SendPasswordResetOTP(ctx context.Context, toEmail, firstName, otp string) error {
	c.logger.InfoContext(ctx, fmt.Sprintf("[MAILER] Password Reset OTP for %s (%s): %s (Valid for 10 minutes)", firstName, toEmail, otp),
		slog.String("to", toEmail),
		slog.String("otp", otp),
		slog.String("purpose", "password_reset"),
	)
	return nil
}

// SentEmail records email parameters for automated test assertions.
type SentEmail struct {
	ToEmail   string
	FirstName string
	OTP       string
	Purpose   string
}

// MockMailer captures sent emails in memory for unit and integration testing.
type MockMailer struct {
	mu     sync.Mutex
	emails []SentEmail
}

func NewMockMailer() *MockMailer {
	return &MockMailer{
		emails: make([]SentEmail, 0),
	}
}

func (m *MockMailer) SendVerificationOTP(ctx context.Context, toEmail, firstName, otp string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.emails = append(m.emails, SentEmail{
		ToEmail:   toEmail,
		FirstName: firstName,
		OTP:       otp,
		Purpose:   "email_verification",
	})
	return nil
}

func (m *MockMailer) SendPasswordResetOTP(ctx context.Context, toEmail, firstName, otp string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.emails = append(m.emails, SentEmail{
		ToEmail:   toEmail,
		FirstName: firstName,
		OTP:       otp,
		Purpose:   "password_reset",
	})
	return nil
}

// LastEmail returns the most recently sent email or nil.
func (m *MockMailer) LastEmail() *SentEmail {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.emails) == 0 {
		return nil
	}
	item := m.emails[len(m.emails)-1]
	return &item
}

// Reset clears recorded emails.
func (m *MockMailer) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.emails = make([]SentEmail, 0)
}
