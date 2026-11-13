package events

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// RetryIntervals defines the 5-stage exponential retry backoff (1m, 5m, 30m, 2h, 6h).
var RetryIntervals = []time.Duration{
	1 * time.Minute,
	5 * time.Minute,
	30 * time.Minute,
	2 * time.Hour,
	6 * time.Hour,
}

// SignPayload computes HMAC-SHA256 signature formatted as sha256=<hex> on "{timestamp}.{body}".
func SignPayload(secret, timestamp string, bodyBytes []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s.%s", timestamp, string(bodyBytes))))
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// WebhookDispatcher dispatches outbound webhook notifications with HMAC-SHA256 signatures,
// enforces SSRF guard policies, and logs delivery attempts.
type WebhookDispatcher struct {
	webhookRepo  repository.WebhookRepository
	deliveryRepo repository.WebhookDeliveryRepository
	ssrfGuard    *netguard.SSRFGuard
	httpClient   *http.Client
	idGen        ids.IDGenerator
}

// NewWebhookDispatcher initializes an outbound webhook dispatcher.
func NewWebhookDispatcher(
	webhookRepo repository.WebhookRepository,
	deliveryRepo repository.WebhookDeliveryRepository,
	ssrfGuard *netguard.SSRFGuard,
	httpClient *http.Client,
) *WebhookDispatcher {
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: 10 * time.Second,
		}
	}

	return &WebhookDispatcher{
		webhookRepo:  webhookRepo,
		deliveryRepo: deliveryRepo,
		ssrfGuard:    ssrfGuard,
		httpClient:   httpClient,
		idGen:        ids.NewUUIDv7Generator(),
	}
}

// RegisterSubscriber attaches the dispatcher to the system event bus.
func (d *WebhookDispatcher) RegisterSubscriber(bus EventBus) {
	bus.SubscribeAll(func(ctx context.Context, event SystemEvent) error {
		return d.HandleSystemEvent(ctx, event)
	})
}

// HandleSystemEvent discovers active subscribers and sends notifications.
func (d *WebhookDispatcher) HandleSystemEvent(ctx context.Context, event SystemEvent) error {
	if event.ProjectID == "" {
		return nil
	}

	hooks, err := d.webhookRepo.ListActiveByProjectAndEvent(ctx, event.ProjectID, event.Type)
	if err != nil {
		return err
	}

	for _, hook := range hooks {
		_ = d.DeliverToHook(ctx, hook, event.Type, event.Data)
	}

	return nil
}

// DeliverToHook builds, signs, and executes an HTTP delivery to a target webhook.
func (d *WebhookDispatcher) DeliverToHook(ctx context.Context, hook *domain.Webhook, eventType domain.WebhookEventType, data interface{}) error {
	deliveryID := d.idGen.MustNewUUIDv7()
	now := time.Now()

	payload := domain.OutboundWebhookPayload{
		ID:        deliveryID,
		Event:     eventType,
		CreatedAt: now,
		ProjectID: hook.ProjectID,
		Data:      data,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	delivery := &domain.WebhookDelivery{
		ID:             deliveryID,
		WebhookID:      hook.ID,
		ProjectID:      hook.ProjectID,
		OrgID:          hook.OrgID,
		Event:          eventType,
		Status:         "pending",
		RequestPayload: string(bodyBytes),
		Attempts:       1,
		CreatedAt:      now,
	}

	// 1. SSRF Validation
	if d.ssrfGuard != nil {
		if _, err := d.ssrfGuard.ValidateTargetURL(ctx, hook.URL); err != nil {
			delivery.Status = "failed"
			delivery.ResponsePayload = fmt.Sprintf("SSRF Guard blocked URL: %v", err)
			_ = d.deliveryRepo.Create(ctx, delivery)
			return err
		}
	}

	// 2. Dispatch HTTP Request
	d.executeDelivery(ctx, hook, delivery, bodyBytes)
	return d.deliveryRepo.Create(ctx, delivery)
}

func (d *WebhookDispatcher) executeDelivery(ctx context.Context, hook *domain.Webhook, delivery *domain.WebhookDelivery, bodyBytes []byte) {
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	signature := SignPayload(hook.Secret, timestamp, bodyBytes)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, hook.URL, bytes.NewReader(bodyBytes))
	if err != nil {
		delivery.Status = "failed"
		delivery.ResponsePayload = err.Error()
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Strim-Event", string(delivery.Event))
	req.Header.Set("X-Strim-Delivery", delivery.ID)
	req.Header.Set("X-Strim-Timestamp", timestamp)
	req.Header.Set("X-Strim-Signature", signature)

	start := time.Now()
	resp, err := d.httpClient.Do(req)
	delivery.DurationMs = time.Since(start).Milliseconds()

	if err != nil {
		delivery.Status = "failed"
		delivery.ResponsePayload = err.Error()
		d.scheduleRetry(delivery)
		return
	}
	defer resp.Body.Close()

	delivery.StatusCode = resp.StatusCode
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	delivery.ResponsePayload = string(respBody)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		delivery.Status = "success"
		delivery.NextRetryAt = nil
	} else {
		delivery.Status = "failed"
		d.scheduleRetry(delivery)
	}
}

func (d *WebhookDispatcher) scheduleRetry(delivery *domain.WebhookDelivery) {
	if delivery.Attempts <= len(RetryIntervals) {
		interval := RetryIntervals[delivery.Attempts-1]
		next := time.Now().Add(interval)
		delivery.NextRetryAt = &next
	} else {
		delivery.NextRetryAt = nil
	}
}

// Redeliver re-attempts delivery for an existing WebhookDelivery record.
func (d *WebhookDispatcher) Redeliver(ctx context.Context, projectID, deliveryID string) (*domain.WebhookDelivery, error) {
	delivery, err := d.deliveryRepo.FindByID(ctx, projectID, deliveryID)
	if err != nil {
		return nil, err
	}

	hook, err := d.webhookRepo.FindByID(ctx, projectID, delivery.WebhookID)
	if err != nil {
		return nil, err
	}

	delivery.Attempts++
	d.executeDelivery(ctx, hook, delivery, []byte(delivery.RequestPayload))

	if err := d.deliveryRepo.Update(ctx, delivery); err != nil {
		return nil, err
	}

	return delivery, nil
}
