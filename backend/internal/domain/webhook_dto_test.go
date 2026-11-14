package domain

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCreateWebhookRequest_Validate(t *testing.T) {
	req := &CreateWebhookRequest{
		URL:    "https://example.com/webhook",
		Events: []string{string(EventTestCompleted), string(EventIncidentOpened)},
	}
	assert.Nil(t, req.Validate())

	// Insecure HTTP rejected
	req.URL = "http://example.com/webhook"
	assert.NotNil(t, req.Validate())

	// Empty events rejected
	req.URL = "https://example.com/webhook"
	req.Events = nil
	assert.NotNil(t, req.Validate())

	// Invalid event rejected
	req.Events = []string{"unknown.event"}
	assert.NotNil(t, req.Validate())

	// Wildcard event accepted
	req.Events = []string{"*"}
	assert.Nil(t, req.Validate())
}

func TestWebhook_MatchesEvent(t *testing.T) {
	w := &Webhook{
		Active: true,
		Events: StringArray{string(EventTestCompleted), string(EventIncidentOpened)},
	}
	assert.True(t, w.MatchesEvent(EventTestCompleted))
	assert.True(t, w.MatchesEvent(EventIncidentOpened))
	assert.False(t, w.MatchesEvent(EventTestFailed))

	// Inactive webhook
	w.Active = false
	assert.False(t, w.MatchesEvent(EventTestCompleted))

	// Wildcard
	w.Active = true
	w.Events = StringArray{"*"}
	assert.True(t, w.MatchesEvent(EventEndpointFound))
}

func TestToWebhookResponse_SecretMasked(t *testing.T) {
	w := &Webhook{
		ID:        "wh-1",
		ProjectID: "proj-1",
		URL:       "https://example.com/hook",
		Secret:    "super-secret-hmac-key",
		Events:    StringArray{string(EventTestStarted)},
		Active:    true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	resp := ToWebhookResponse(w)
	assert.Equal(t, "wh-1", resp.ID)
	assert.Equal(t, "***", resp.Secret)
}
