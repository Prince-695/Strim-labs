package mailer

import (
	"context"
	"crypto/tls"
	"fmt"
	"html"
	"log/slog"
	"net/smtp"
	"sync"

	"github.com/Prince-695/strim/backend/internal/templates"
)

// Mailer defines transactional email sending capabilities.
type Mailer interface {
	SendVerificationOTP(ctx context.Context, toEmail, firstName, otp string) error
	SendPasswordResetOTP(ctx context.Context, toEmail, firstName, otp string) error
	SendAlertNotification(ctx context.Context, toEmail, subject, body string) error
	SendWelcomeEmail(ctx context.Context, toEmail, firstName string) error
}

// SMTPConfig holds connection details for sending email over SMTP.
type SMTPConfig struct {
	Host      string
	Port      int
	User      string
	Password  string
	From      string
	WebOrigin string
}

// SMTPMailer delivers transactional emails via an external SMTP server.
type SMTPMailer struct {
	cfg    SMTPConfig
	logger *slog.Logger
}

// NewSMTPMailer returns a production-ready Mailer targeting an external SMTP server (e.g. Brevo/Gmail port 465 SSL/TLS).
func NewSMTPMailer(cfg SMTPConfig, logger *slog.Logger) *SMTPMailer {
	if logger == nil {
		logger = slog.Default()
	}
	return &SMTPMailer{
		cfg:    cfg,
		logger: logger,
	}
}

func (s *SMTPMailer) sendMail(toEmail, subject, htmlBody string) error {
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	from := s.cfg.From
	if from == "" {
		from = s.cfg.User
	}

	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n", from, toEmail, subject)
	msg := []byte(headers + htmlBody)

	auth := smtp.PlainAuth("", s.cfg.User, s.cfg.Password, s.cfg.Host)

	// Port 465 uses direct SSL/TLS
	if s.cfg.Port == 465 {
		tlsConfig := &tls.Config{
			ServerName: s.cfg.Host,
			MinVersion: tls.VersionTLS12,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to dial SMTP TLS on port 465: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, s.cfg.Host)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
		defer client.Close()

		if s.cfg.User != "" && s.cfg.Password != "" {
			if err = client.Auth(auth); err != nil {
				return fmt.Errorf("SMTP auth failed: %w", err)
			}
		}

		if err = client.Mail(from); err != nil {
			return fmt.Errorf("SMTP MAIL command failed: %w", err)
		}
		if err = client.Rcpt(toEmail); err != nil {
			return fmt.Errorf("SMTP RCPT command failed: %w", err)
		}

		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("SMTP DATA command failed: %w", err)
		}
		if _, err = w.Write(msg); err != nil {
			return fmt.Errorf("failed to write email body: %w", err)
		}
		if err = w.Close(); err != nil {
			return fmt.Errorf("failed to close email body writer: %w", err)
		}
		return client.Quit()
	}

	// Port 587 or standard SMTP with STARTTLS
	return smtp.SendMail(addr, auth, from, []string{toEmail}, msg)
}

func (s *SMTPMailer) SendVerificationOTP(ctx context.Context, toEmail, firstName, otp string) error {
	subject := "Verify your STRIM Labs account"
	body, err := templates.RenderVerificationOTP(templates.VerificationData{
		FirstName:     firstName,
		OTP:           otp,
		ExpiryMinutes: 10,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "Failed to render verification OTP template, using fallback", slog.Any("error", err))
		body = fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
				<h2>Welcome to STRIM Labs</h2>
				<p>Hello %s,</p>
				<p>Your verification code is: <strong>%s</strong> (Valid for 10 minutes)</p>
			</div>`, html.EscapeString(firstName), html.EscapeString(otp))
	}

	if err := s.sendMail(toEmail, subject, body); err != nil {
		s.logger.ErrorContext(ctx, "Failed to deliver verification email", slog.String("to", toEmail), slog.Any("error", err))
		return err
	}
	s.logger.InfoContext(ctx, "Verification email successfully sent", slog.String("to", toEmail))
	return nil
}

func (s *SMTPMailer) SendPasswordResetOTP(ctx context.Context, toEmail, firstName, otp string) error {
	subject := "Reset your STRIM Labs password"
	body, err := templates.RenderPasswordResetOTP(templates.PasswordResetData{
		FirstName:     firstName,
		OTP:           otp,
		ExpiryMinutes: 10,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "Failed to render password reset template, using fallback", slog.Any("error", err))
		body = fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
				<h2>Reset Your Password</h2>
				<p>Hello %s,</p>
				<p>Your password reset code is: <strong>%s</strong> (Valid for 10 minutes)</p>
			</div>`, html.EscapeString(firstName), html.EscapeString(otp))
	}

	if err := s.sendMail(toEmail, subject, body); err != nil {
		s.logger.ErrorContext(ctx, "Failed to deliver password reset email", slog.String("to", toEmail), slog.Any("error", err))
		return err
	}
	s.logger.InfoContext(ctx, "Password reset email successfully sent", slog.String("to", toEmail))
	return nil
}

func (s *SMTPMailer) SendAlertNotification(ctx context.Context, toEmail, subject, body string) error {
	dashboardURL := s.cfg.WebOrigin
	if dashboardURL == "" {
		dashboardURL = "https://strim-labs.com"
	}

	htmlBody, err := templates.ParseAndRenderAlert(subject, body, dashboardURL)
	if err != nil {
		s.logger.ErrorContext(ctx, "Failed to render alert email template, using fallback", slog.Any("error", err))
		htmlBody = fmt.Sprintf(`
			<div style="font-family: monospace; padding: 20px; white-space: pre-wrap;">%s</div>
		`, html.EscapeString(body))
	}

	if err := s.sendMail(toEmail, subject, htmlBody); err != nil {
		s.logger.ErrorContext(ctx, "Failed to deliver alert email", slog.String("to", toEmail), slog.Any("error", err))
		return err
	}
	s.logger.InfoContext(ctx, "Alert email successfully delivered", slog.String("to", toEmail), slog.String("subject", subject))
	return nil
}

func (s *SMTPMailer) SendWelcomeEmail(ctx context.Context, toEmail, firstName string) error {
	subject := "Welcome to STRIM Labs! 🚀"
	dashboardURL := s.cfg.WebOrigin
	if dashboardURL == "" {
		dashboardURL = "https://strim-labs.com"
	}

	body, err := templates.RenderWelcome(templates.WelcomeData{
		FirstName:    firstName,
		DashboardURL: dashboardURL,
	})
	if err != nil {
		s.logger.ErrorContext(ctx, "Failed to render welcome email template, using fallback", slog.Any("error", err))
		body = fmt.Sprintf(`
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
				<h2>Welcome to STRIM Labs, %s!</h2>
				<p>Your account is ready. Access your dashboard at <a href="%s">%s</a></p>
			</div>`, html.EscapeString(firstName), html.EscapeString(dashboardURL), html.EscapeString(dashboardURL))
	}

	if err := s.sendMail(toEmail, subject, body); err != nil {
		s.logger.ErrorContext(ctx, "Failed to deliver welcome email", slog.String("to", toEmail), slog.Any("error", err))
		return err
	}
	s.logger.InfoContext(ctx, "Welcome email successfully sent", slog.String("to", toEmail))
	return nil
}

// ConsoleMailer prints transactional emails to structured logger / standard output.
type ConsoleMailer struct {
	logger *slog.Logger
}

// NewConsoleMailer returns a Mailer implementation for local development and environments without external SMTP.
func NewConsoleMailer(logger *slog.Logger) *ConsoleMailer {
	if logger == nil {
		logger = slog.Default()
	}
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

func (c *ConsoleMailer) SendAlertNotification(ctx context.Context, toEmail, subject, body string) error {
	c.logger.InfoContext(ctx, fmt.Sprintf("[MAILER ALERT] To %s | %s: %s", toEmail, subject, body),
		slog.String("to", toEmail),
		slog.String("subject", subject),
		slog.String("purpose", "alert_notification"),
	)
	return nil
}

func (c *ConsoleMailer) SendWelcomeEmail(ctx context.Context, toEmail, firstName string) error {
	c.logger.InfoContext(ctx, fmt.Sprintf("[MAILER WELCOME] Welcome email dispatched for %s (%s)", firstName, toEmail),
		slog.String("to", toEmail),
		slog.String("purpose", "welcome_onboarding"),
	)
	return nil
}

// SentEmail records email parameters for automated test assertions.
type SentEmail struct {
	ToEmail   string
	FirstName string
	OTP       string
	Subject   string
	Body      string
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

func (m *MockMailer) SendAlertNotification(ctx context.Context, toEmail, subject, body string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.emails = append(m.emails, SentEmail{
		ToEmail: toEmail,
		Subject: subject,
		Body:    body,
		Purpose: "alert_notification",
	})
	return nil
}

func (m *MockMailer) SendWelcomeEmail(ctx context.Context, toEmail, firstName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.emails = append(m.emails, SentEmail{
		ToEmail:   toEmail,
		FirstName: firstName,
		Subject:   "Welcome to STRIM Labs! 🚀",
		Purpose:   "welcome_onboarding",
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

// SentEmails returns all captured emails.
func (m *MockMailer) SentEmails() []SentEmail {
	m.mu.Lock()
	defer m.mu.Unlock()
	res := make([]SentEmail, len(m.emails))
	copy(res, m.emails)
	return res
}

// Reset clears recorded emails.
func (m *MockMailer) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.emails = make([]SentEmail, 0)
}
