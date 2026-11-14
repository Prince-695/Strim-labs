package domain

import (
	"strings"
	"time"
)

// CreateWebhookRequest defines payload to create a new webhook subscription.
type CreateWebhookRequest struct {
	URL    string   `json:"url" validate:"required,url"`
	Events []string `json:"events" validate:"required,min=1"`
	Secret string   `json:"secret,omitempty"` // Optional; generated if omitted
}

// Validate checks request validity.
func (r *CreateWebhookRequest) Validate() *AppError {
	r.URL = strings.TrimSpace(r.URL)
	if r.URL == "" {
		return NewValidationError("url", "Webhook URL is required")
	}
	if !strings.HasPrefix(strings.ToLower(r.URL), "https://") {
		return NewValidationError("url", "Webhook URL must use secure HTTPS scheme")
	}
	if len(r.Events) == 0 {
		return NewValidationError("events", "At least one event trigger must be specified")
	}

	validMap := make(map[string]bool)
	for _, e := range AllWebhookEvents {
		validMap[string(e)] = true
	}
	validMap["*"] = true

	for _, e := range r.Events {
		trimmed := strings.TrimSpace(e)
		if !validMap[trimmed] {
			return NewValidationError("events", "Unsupported webhook event: "+trimmed)
		}
	}
	return nil
}

// UpdateWebhookRequest defines mutable fields for an existing webhook.
type UpdateWebhookRequest struct {
	URL    *string  `json:"url,omitempty"`
	Events []string `json:"events,omitempty"`
	Secret *string  `json:"secret,omitempty"`
	Active *bool    `json:"active,omitempty"`
}

// Validate checks update parameters.
func (r *UpdateWebhookRequest) Validate() *AppError {
	if r.URL != nil {
		u := strings.TrimSpace(*r.URL)
		if u == "" {
			return NewValidationError("url", "Webhook URL cannot be empty")
		}
		if !strings.HasPrefix(strings.ToLower(u), "https://") {
			return NewValidationError("url", "Webhook URL must use secure HTTPS scheme")
		}
	}
	if r.Events != nil {
		if len(r.Events) == 0 {
			return NewValidationError("events", "At least one event trigger must be specified")
		}
		validMap := make(map[string]bool)
		for _, e := range AllWebhookEvents {
			validMap[string(e)] = true
		}
		validMap["*"] = true
		for _, e := range r.Events {
			if !validMap[strings.TrimSpace(e)] {
				return NewValidationError("events", "Unsupported webhook event: "+e)
			}
		}
	}
	return nil
}

// WebhookResponse represents the public view of a webhook with secret masked.
type WebhookResponse struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	URL       string    `json:"url"`
	Events    []string  `json:"events"`
	Secret    string    `json:"secret"` // Always masked as "***"
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ToWebhookResponse converts Webhook model to masked DTO.
func ToWebhookResponse(w *Webhook) WebhookResponse {
	return WebhookResponse{
		ID:        w.ID,
		ProjectID: w.ProjectID,
		URL:       w.URL,
		Events:    w.Events,
		Secret:    "***",
		Active:    w.Active,
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
	}
}

// WebhookDeliveryResponse represents delivery execution history.
type WebhookDeliveryResponse struct {
	ID              string           `json:"id"`
	WebhookID       string           `json:"webhook_id"`
	Event           WebhookEventType `json:"event"`
	Status          string           `json:"status"`
	StatusCode      int              `json:"status_code"`
	DurationMs      int64            `json:"duration_ms"`
	Attempts        int              `json:"attempts"`
	RequestPayload  string           `json:"request_payload,omitempty"`
	ResponsePayload string           `json:"response_payload,omitempty"`
	CreatedAt       time.Time        `json:"created_at"`
}

// ToWebhookDeliveryResponse converts WebhookDelivery model to DTO.
func ToWebhookDeliveryResponse(d *WebhookDelivery) WebhookDeliveryResponse {
	return WebhookDeliveryResponse{
		ID:              d.ID,
		WebhookID:       d.WebhookID,
		Event:           d.Event,
		Status:          d.Status,
		StatusCode:      d.StatusCode,
		DurationMs:      d.DurationMs,
		Attempts:        d.Attempts,
		RequestPayload:  d.RequestPayload,
		ResponsePayload: d.ResponsePayload,
		CreatedAt:       d.CreatedAt,
	}
}

// OutboundWebhookPayload is the standard envelope delivered to target URLs.
type OutboundWebhookPayload struct {
	ID        string           `json:"id"`
	Event     WebhookEventType `json:"event"`
	CreatedAt time.Time        `json:"created_at"`
	ProjectID string           `json:"project_id"`
	Data      interface{}      `json:"data"`
}
