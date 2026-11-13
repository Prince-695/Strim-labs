package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/events"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
)

// WebhookService manages outbound webhook registrations and delivery investigations.
type WebhookService struct {
	webhookRepo  repository.WebhookRepository
	deliveryRepo repository.WebhookDeliveryRepository
	projectRepo  repository.ProjectRepository
	ssrfGuard    *netguard.SSRFGuard
	dispatcher   *events.WebhookDispatcher
	auditRec     audit.Recorder
	idGen        ids.IDGenerator
}

// NewWebhookService initializes a WebhookService.
func NewWebhookService(
	webhookRepo repository.WebhookRepository,
	deliveryRepo repository.WebhookDeliveryRepository,
	projectRepo repository.ProjectRepository,
	ssrfGuard *netguard.SSRFGuard,
	dispatcher *events.WebhookDispatcher,
	auditRec audit.Recorder,
) *WebhookService {
	return &WebhookService{
		webhookRepo:  webhookRepo,
		deliveryRepo: deliveryRepo,
		projectRepo:  projectRepo,
		ssrfGuard:    ssrfGuard,
		dispatcher:   dispatcher,
		auditRec:     auditRec,
		idGen:        ids.NewUUIDv7Generator(),
	}
}

// CreateWebhook validates endpoint security, generates HMAC secrets, and registers a webhook subscription.
func (s *WebhookService) CreateWebhook(ctx context.Context, orgID, projectID string, req *domain.CreateWebhookRequest) (*domain.WebhookResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	if appErr := req.Validate(); appErr != nil {
		return nil, appErr
	}

	if s.ssrfGuard != nil {
		if _, err := s.ssrfGuard.ValidateTargetURL(ctx, req.URL); err != nil {
			return nil, domain.NewTargetBlockedError(err.Error())
		}
	}

	secret := req.Secret
	if secret == "" {
		b := make([]byte, 16)
		_, _ = rand.Read(b)
		secret = hex.EncodeToString(b)
	}

	now := time.Now()
	hook := &domain.Webhook{
		ID:        s.idGen.MustNewUUIDv7(),
		ProjectID: projectID,
		OrgID:     orgID,
		URL:       req.URL,
		Secret:    secret,
		Events:    req.Events,
		Active:    true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.webhookRepo.Create(ctx, hook); err != nil {
		return nil, err
	}

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "webhook.created", "webhook", hook.ID, nil, map[string]interface{}{
			"url":    hook.URL,
			"events": hook.Events,
		})
	}

	resp := domain.ToWebhookResponse(hook)
	return &resp, nil
}

// ListWebhooks returns all configured webhooks for a project.
func (s *WebhookService) ListWebhooks(ctx context.Context, orgID, projectID string) ([]domain.WebhookResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	hooks, err := s.webhookRepo.ListByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	resp := make([]domain.WebhookResponse, 0, len(hooks))
	for _, h := range hooks {
		resp = append(resp, domain.ToWebhookResponse(h))
	}
	return resp, nil
}

// UpdateWebhook updates an existing webhook's parameters.
func (s *WebhookService) UpdateWebhook(ctx context.Context, orgID, projectID, webhookID string, req *domain.UpdateWebhookRequest) (*domain.WebhookResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	if appErr := req.Validate(); appErr != nil {
		return nil, appErr
	}

	hook, err := s.webhookRepo.FindByID(ctx, projectID, webhookID)
	if err != nil {
		return nil, err
	}

	before := map[string]interface{}{
		"url":    hook.URL,
		"events": hook.Events,
		"active": hook.Active,
	}

	if req.URL != nil {
		if s.ssrfGuard != nil {
			if _, err := s.ssrfGuard.ValidateTargetURL(ctx, *req.URL); err != nil {
				return nil, domain.NewTargetBlockedError(err.Error())
			}
		}
		hook.URL = *req.URL
	}
	if req.Events != nil {
		hook.Events = req.Events
	}
	if req.Secret != nil && *req.Secret != "" {
		hook.Secret = *req.Secret
	}
	if req.Active != nil {
		hook.Active = *req.Active
	}
	hook.UpdatedAt = time.Now()

	if err := s.webhookRepo.Update(ctx, hook); err != nil {
		return nil, err
	}

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "webhook.updated", "webhook", hook.ID, before, map[string]interface{}{
			"url":    hook.URL,
			"events": hook.Events,
			"active": hook.Active,
		})
	}

	resp := domain.ToWebhookResponse(hook)
	return &resp, nil
}

// DeleteWebhook removes a webhook subscription.
func (s *WebhookService) DeleteWebhook(ctx context.Context, orgID, projectID, webhookID string) error {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return err
	}

	hook, err := s.webhookRepo.FindByID(ctx, projectID, webhookID)
	if err != nil {
		return err
	}

	if err := s.webhookRepo.Delete(ctx, projectID, webhookID); err != nil {
		return err
	}

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "webhook.deleted", "webhook", webhookID, map[string]interface{}{
			"url": hook.URL,
		}, nil)
	}

	return nil
}

// ListDeliveries returns historical delivery records for a webhook.
func (s *WebhookService) ListDeliveries(ctx context.Context, orgID, projectID, webhookID, status string, limit int, cursor string) ([]domain.WebhookDeliveryResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	if _, err := s.webhookRepo.FindByID(ctx, projectID, webhookID); err != nil {
		return nil, err
	}

	deliveries, err := s.deliveryRepo.ListByWebhook(ctx, webhookID, status, limit, cursor)
	if err != nil {
		return nil, err
	}

	resp := make([]domain.WebhookDeliveryResponse, 0, len(deliveries))
	for _, d := range deliveries {
		resp = append(resp, domain.ToWebhookDeliveryResponse(d))
	}
	return resp, nil
}

// Redeliver immediately triggers re-dispatch of a previous delivery.
func (s *WebhookService) Redeliver(ctx context.Context, orgID, projectID, webhookID, deliveryID string) (*domain.WebhookDeliveryResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	if _, err := s.webhookRepo.FindByID(ctx, projectID, webhookID); err != nil {
		return nil, err
	}

	if s.dispatcher == nil {
		return nil, domain.NewServiceUnavailableError("Webhook dispatcher not configured", nil)
	}

	delivery, err := s.dispatcher.Redeliver(ctx, projectID, deliveryID)
	if err != nil {
		return nil, err
	}

	resp := domain.ToWebhookDeliveryResponse(delivery)
	return &resp, nil
}
