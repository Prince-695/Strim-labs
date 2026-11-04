package mailer

import (
	"context"
	"crypto/tls"
	"fmt"
	"html"
	"log/slog"
	"net/smtp"
	"sync"
)

// Mailer defines transactional email sending capabilities.
type Mailer interface {
	SendVerificationOTP(ctx context.Context, toEmail, firstName, otp string) error
	SendPasswordResetOTP(ctx context.Context, toEmail, firstName, otp string) error
}

// SMTPConfig holds connection details for sending email over SMTP.
type SMTPConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
}

// SMTPMailer delivers transactional emails via an external SMTP server.
type SMTPMailer struct {
	cfg    SMTPConfig
	logger *slog.Logger
}

// NewSMTPMailer returns a production-ready Mailer targeting an external SMTP server (e.g. Gmail port 465 SSL/TLS).
func NewSMTPMailer(cfg SMTPConfig, logger *slog.Logger) *SMTPMailer {
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
	body := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
			<h2 style="color: #6366f1; margin-top: 0;">Welcome to STRIM Labs</h2>
			<p>Hello %s,</p>
			<p>Thank you for signing up. Please use the following 6-digit verification code to verify your account:</p>
			<div style="background: #f3f4f6; padding: 18px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1f2937; margin: 24px 0;">
				%s
			</div>
			<p style="color: #6b7280; font-size: 14px;">This code is valid for 10 minutes. If you did not create an account, please disregard this email.</p>
		</div>
	`, html.EscapeString(firstName), html.EscapeString(otp))

	if err := s.sendMail(toEmail, subject, body); err != nil {
		s.logger.ErrorContext(ctx, "Failed to deliver verification email", slog.String("to", toEmail), slog.Any("error", err))
		return err
	}
	s.logger.InfoContext(ctx, "Verification email successfully sent", slog.String("to", toEmail))
	return nil
}

func (s *SMTPMailer) SendPasswordResetOTP(ctx context.Context, toEmail, firstName, otp string) error {
	subject := "Reset your STRIM Labs password"
	body := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
			<h2 style="color: #6366f1; margin-top: 0;">Reset Your Password</h2>
			<p>Hello %s,</p>
			<p>We received a request to reset your password. Use the following 6-digit verification code to proceed:</p>
			<div style="background: #f3f4f6; padding: 18px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1f2937; margin: 24px 0;">
				%s
			</div>
			<p style="color: #6b7280; font-size: 14px;">This code is valid for 10 minutes. If you did not request a password reset, please secure your account immediately.</p>
		</div>
	`, html.EscapeString(firstName), html.EscapeString(otp))

	if err := s.sendMail(toEmail, subject, body); err != nil {
		s.logger.ErrorContext(ctx, "Failed to deliver password reset email", slog.String("to", toEmail), slog.Any("error", err))
		return err
	}
	s.logger.InfoContext(ctx, "Password reset email successfully sent", slog.String("to", toEmail))
	return nil
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
