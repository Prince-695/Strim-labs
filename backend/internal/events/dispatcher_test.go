package events

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInProcessBus_PublishAndSubscribe(t *testing.T) {
	bus := NewInProcessBus(10, 2)
	defer bus.Close()

	var wg sync.WaitGroup
	wg.Add(2)

	var receivedSpecific SystemEvent
	var receivedAll SystemEvent

	bus.Subscribe(domain.EventTestCompleted, func(ctx context.Context, event SystemEvent) error {
		receivedSpecific = event
		wg.Done()
		return nil
	})

	bus.SubscribeAll(func(ctx context.Context, event SystemEvent) error {
		receivedAll = event
		wg.Done()
		return nil
	})

	bus.Publish(context.Background(), SystemEvent{
		ID:        "evt-1",
		Type:      domain.EventTestCompleted,
		ProjectID: "proj-1",
		OrgID:     "org-1",
		Data:      map[string]interface{}{"status": "completed"},
	})

	wg.Wait()

	assert.Equal(t, "evt-1", receivedSpecific.ID)
	assert.Equal(t, "evt-1", receivedAll.ID)
}

func TestWebhookDispatcher_DeliverySuccessAndSignature(t *testing.T) {
	var receivedHeaderSig string
	var receivedHeaderEvent string
	var receivedBody string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedHeaderSig = r.Header.Get("X-Strim-Signature")
		receivedHeaderEvent = r.Header.Get("X-Strim-Event")
		b, _ := io.ReadAll(r.Body)
		receivedBody = string(b)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"received": true}`))
	}))
	defer server.Close()

	webhookRepo := repository.NewInMemoryWebhookRepository()
	deliveryRepo := repository.NewInMemoryWebhookDeliveryRepository()

	hook := &domain.Webhook{
		ID:        "wh-1",
		ProjectID: "proj-1",
		OrgID:     "org-1",
		URL:       server.URL,
		Secret:    "secret-token-key-123",
		Events:    domain.StringArray{string(domain.EventTestCompleted)},
		Active:    true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_ = webhookRepo.Create(context.Background(), hook)

	dispatcher := NewWebhookDispatcher(webhookRepo, deliveryRepo, nil, server.Client())

	err := dispatcher.DeliverToHook(context.Background(), hook, domain.EventTestCompleted, map[string]string{"result": "pass"})
	require.NoError(t, err)

	assert.Equal(t, string(domain.EventTestCompleted), receivedHeaderEvent)
	assert.True(t, strings.HasPrefix(receivedHeaderSig, "sha256="))
	assert.Contains(t, receivedBody, "pass")

	// Check delivery record in repository
	deliveries, err := deliveryRepo.ListByWebhook(context.Background(), "wh-1", "success", 10, "")
	require.NoError(t, err)
	require.Len(t, deliveries, 1)
	assert.Equal(t, "success", deliveries[0].Status)
	assert.Equal(t, 200, deliveries[0].StatusCode)
	assert.Nil(t, deliveries[0].NextRetryAt)
}

func TestWebhookDispatcher_DeliveryFailureAndRetry(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer server.Close()

	webhookRepo := repository.NewInMemoryWebhookRepository()
	deliveryRepo := repository.NewInMemoryWebhookDeliveryRepository()

	hook := &domain.Webhook{
		ID:        "wh-err",
		ProjectID: "proj-1",
		OrgID:     "org-1",
		URL:       server.URL,
		Secret:    "secret-123",
		Events:    domain.StringArray{string(domain.EventIncidentOpened)},
		Active:    true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	_ = webhookRepo.Create(context.Background(), hook)

	dispatcher := NewWebhookDispatcher(webhookRepo, deliveryRepo, nil, server.Client())

	err := dispatcher.DeliverToHook(context.Background(), hook, domain.EventIncidentOpened, map[string]string{"incident": "inc-1"})
	require.NoError(t, err)

	deliveries, err := deliveryRepo.ListByWebhook(context.Background(), "wh-err", "failed", 10, "")
	require.NoError(t, err)
	require.Len(t, deliveries, 1)
	assert.Equal(t, "failed", deliveries[0].Status)
	assert.Equal(t, 500, deliveries[0].StatusCode)
	assert.NotNil(t, deliveries[0].NextRetryAt)
}
