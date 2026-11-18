package templates

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"strings"
	"sync"
)

//go:embed *.html
var templateFS embed.FS

var (
	parsedTemplates *template.Template
	parseOnce       sync.Once
	parseErr        error
)

func getTemplates() (*template.Template, error) {
	parseOnce.Do(func() {
		parsedTemplates, parseErr = template.ParseFS(templateFS, "*.html")
	})
	return parsedTemplates, parseErr
}

// VerificationData holds parameters for the email verification OTP template.
type VerificationData struct {
	FirstName     string
	OTP           string
	ExpiryMinutes int
}

// PasswordResetData holds parameters for the password reset OTP template.
type PasswordResetData struct {
	FirstName     string
	OTP           string
	ExpiryMinutes int
}

// WelcomeData holds parameters for the post-authentication welcome email template.
type WelcomeData struct {
	FirstName    string
	DashboardURL string
}

// AlertData holds parameters for operational and incident alert emails.
type AlertData struct {
	Subject        string
	Title          string
	Summary        string
	IncidentID     string
	RuleName       string
	Status         string
	Severity       string
	MetricValue    string
	ThresholdValue string
	Timestamp      string
	DashboardURL   string
	RawBody        string
}

// RenderVerificationOTP renders the verification OTP HTML email.
func RenderVerificationOTP(data VerificationData) (string, error) {
	if data.ExpiryMinutes <= 0 {
		data.ExpiryMinutes = 10
	}
	tmpl, err := getTemplates()
	if err != nil {
		return "", fmt.Errorf("failed to load email templates: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "verification_otp.html", data); err != nil {
		return "", fmt.Errorf("failed to execute verification_otp template: %w", err)
	}
	return buf.String(), nil
}

// RenderPasswordResetOTP renders the password reset OTP HTML email.
func RenderPasswordResetOTP(data PasswordResetData) (string, error) {
	if data.ExpiryMinutes <= 0 {
		data.ExpiryMinutes = 10
	}
	tmpl, err := getTemplates()
	if err != nil {
		return "", fmt.Errorf("failed to load email templates: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "password_reset_otp.html", data); err != nil {
		return "", fmt.Errorf("failed to execute password_reset_otp template: %w", err)
	}
	return buf.String(), nil
}

// RenderWelcome renders the welcome email template.
func RenderWelcome(data WelcomeData) (string, error) {
	tmpl, err := getTemplates()
	if err != nil {
		return "", fmt.Errorf("failed to load email templates: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "welcome.html", data); err != nil {
		return "", fmt.Errorf("failed to execute welcome template: %w", err)
	}
	return buf.String(), nil
}

// RenderAlertNotification renders an incident or operational alert email.
func RenderAlertNotification(data AlertData) (string, error) {
	tmpl, err := getTemplates()
	if err != nil {
		return "", fmt.Errorf("failed to load email templates: %w", err)
	}

	if data.Title == "" {
		data.Title = data.Subject
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "alert_notification.html", data); err != nil {
		return "", fmt.Errorf("failed to execute alert_notification template: %w", err)
	}
	return buf.String(), nil
}

// ParseAndRenderAlert parses structured text from dispatcher body and renders the alert email.
func ParseAndRenderAlert(subject, body, dashboardURL string) (string, error) {
	data := AlertData{
		Subject:      subject,
		Title:        subject,
		DashboardURL: dashboardURL,
	}

	lines := strings.Split(body, "\n")
	hasStructuredLines := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		parts := strings.SplitN(trimmed, ":", 2)
		if len(parts) == 2 {
			k := strings.ToLower(strings.TrimSpace(parts[0]))
			v := strings.TrimSpace(parts[1])

			switch k {
			case "incident id":
				data.IncidentID = v
				hasStructuredLines = true
			case "status":
				data.Status = strings.ToUpper(v)
				hasStructuredLines = true
			case "severity":
				data.Severity = strings.ToLower(v)
				hasStructuredLines = true
			case "summary":
				data.Summary = v
				hasStructuredLines = true
			case "time":
				data.Timestamp = v
				hasStructuredLines = true
			case "metric value":
				// E.g. "450.00 (Threshold: 200.00)"
				data.MetricValue = v
				hasStructuredLines = true
			}
		}
	}

	// If body was not formatted as key-value lines, preserve as RawBody
	if !hasStructuredLines || data.Summary == "" {
		data.RawBody = body
	}

	return RenderAlertNotification(data)
}
