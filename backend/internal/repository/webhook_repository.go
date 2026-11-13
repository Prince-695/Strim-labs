package repository

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

// WebhookRepository defines persistence operations for outbound webhooks.
type WebhookRepository interface {
	Create(ctx context.Context, hook *domain.Webhook) error
	FindByID(ctx context.Context, projectID, webhookID string) (*domain.Webhook, error)
	ListByProject(ctx context.Context, projectID string) ([]*domain.Webhook, error)
	ListActiveByProjectAndEvent(ctx context.Context, projectID string, event domain.WebhookEventType) ([]*domain.Webhook, error)
	Update(ctx context.Context, hook *domain.Webhook) error
	Delete(ctx context.Context, projectID, webhookID string) error
}

// WebhookDeliveryRepository defines persistence operations for outbound delivery execution logs.
type WebhookDeliveryRepository interface {
	Create(ctx context.Context, delivery *domain.WebhookDelivery) error
	FindByID(ctx context.Context, projectID, deliveryID string) (*domain.WebhookDelivery, error)
	ListByWebhook(ctx context.Context, webhookID string, status string, limit int, cursor string) ([]*domain.WebhookDelivery, error)
	Update(ctx context.Context, delivery *domain.WebhookDelivery) error
}

// --- GORM Implementations ---

type GormWebhookRepository struct {
	db *database.DB
}

func NewWebhookRepository(db *database.DB) *GormWebhookRepository {
	return &GormWebhookRepository{db: db}
}

func (r *GormWebhookRepository) Create(ctx context.Context, hook *domain.Webhook) error {
	return r.db.WithContext(ctx).Create(hook).Error
}

func (r *GormWebhookRepository) FindByID(ctx context.Context, projectID, webhookID string) (*domain.Webhook, error) {
	var hook domain.Webhook
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", webhookID, projectID).
		First(&hook).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewWebhookNotFoundError()
		}
		return nil, domain.NewInternalError(err)
	}
	return &hook, nil
}

func (r *GormWebhookRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.Webhook, error) {
	var hooks []*domain.Webhook
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at desc").
		Find(&hooks).Error
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return hooks, nil
}

func (r *GormWebhookRepository) ListActiveByProjectAndEvent(ctx context.Context, projectID string, event domain.WebhookEventType) ([]*domain.Webhook, error) {
	var allHooks []*domain.Webhook
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND active = ?", projectID, true).
		Find(&allHooks).Error
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	var matching []*domain.Webhook
	for _, h := range allHooks {
		if h.MatchesEvent(event) {
			matching = append(matching, h)
		}
	}
	return matching, nil
}

func (r *GormWebhookRepository) Update(ctx context.Context, hook *domain.Webhook) error {
	res := r.db.WithContext(ctx).
		Model(&domain.Webhook{}).
		Where("id = ? AND project_id = ?", hook.ID, hook.ProjectID).
		Updates(map[string]interface{}{
			"url":        hook.URL,
			"secret":     hook.Secret,
			"events":     hook.Events,
			"active":     hook.Active,
			"updated_at": hook.UpdatedAt,
		})
	if res.Error != nil {
		return domain.NewInternalError(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.NewWebhookNotFoundError()
	}
	return nil
}

func (r *GormWebhookRepository) Delete(ctx context.Context, projectID, webhookID string) error {
	res := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", webhookID, projectID).
		Delete(&domain.Webhook{})
	if res.Error != nil {
		return domain.NewInternalError(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.NewWebhookNotFoundError()
	}
	return nil
}

// --- GORM WebhookDeliveryRepository ---

type GormWebhookDeliveryRepository struct {
	db *database.DB
}

func NewWebhookDeliveryRepository(db *database.DB) *GormWebhookDeliveryRepository {
	return &GormWebhookDeliveryRepository{db: db}
}

func (r *GormWebhookDeliveryRepository) Create(ctx context.Context, delivery *domain.WebhookDelivery) error {
	return r.db.WithContext(ctx).Create(delivery).Error
}

func (r *GormWebhookDeliveryRepository) FindByID(ctx context.Context, projectID, deliveryID string) (*domain.WebhookDelivery, error) {
	var delivery domain.WebhookDelivery
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", deliveryID, projectID).
		First(&delivery).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewDeliveryNotFoundError()
		}
		return nil, domain.NewInternalError(err)
	}
	return &delivery, nil
}

func (r *GormWebhookDeliveryRepository) ListByWebhook(ctx context.Context, webhookID string, status string, limit int, cursor string) ([]*domain.WebhookDelivery, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	query := r.db.WithContext(ctx).
		Where("webhook_id = ?", webhookID)

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if cursor != "" {
		query = query.Where("created_at < ?", cursor)
	}

	var deliveries []*domain.WebhookDelivery
	err := query.Order("created_at desc").Limit(limit).Find(&deliveries).Error
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return deliveries, nil
}

func (r *GormWebhookDeliveryRepository) Update(ctx context.Context, delivery *domain.WebhookDelivery) error {
	return r.db.WithContext(ctx).Save(delivery).Error
}

// --- In-Memory Implementations for fast testing ---

type InMemoryWebhookRepository struct {
	mu    sync.RWMutex
	hooks map[string]*domain.Webhook
}

func NewInMemoryWebhookRepository() *InMemoryWebhookRepository {
	return &InMemoryWebhookRepository{
		hooks: make(map[string]*domain.Webhook),
	}
}

func (r *InMemoryWebhookRepository) Create(ctx context.Context, hook *domain.Webhook) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cpy := *hook
	r.hooks[hook.ID] = &cpy
	return nil
}

func (r *InMemoryWebhookRepository) FindByID(ctx context.Context, projectID, webhookID string) (*domain.Webhook, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	h, ok := r.hooks[webhookID]
	if !ok || h.ProjectID != projectID {
		return nil, domain.NewWebhookNotFoundError()
	}
	cpy := *h
	return &cpy, nil
}

func (r *InMemoryWebhookRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.Webhook, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*domain.Webhook
	for _, h := range r.hooks {
		if h.ProjectID == projectID {
			cpy := *h
			list = append(list, &cpy)
		}
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})
	return list, nil
}

func (r *InMemoryWebhookRepository) ListActiveByProjectAndEvent(ctx context.Context, projectID string, event domain.WebhookEventType) ([]*domain.Webhook, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var matching []*domain.Webhook
	for _, h := range r.hooks {
		if h.ProjectID == projectID && h.MatchesEvent(event) {
			cpy := *h
			matching = append(matching, &cpy)
		}
	}
	return matching, nil
}

func (r *InMemoryWebhookRepository) Update(ctx context.Context, hook *domain.Webhook) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	h, ok := r.hooks[hook.ID]
	if !ok || h.ProjectID != hook.ProjectID {
		return domain.NewWebhookNotFoundError()
	}
	cpy := *hook
	r.hooks[hook.ID] = &cpy
	return nil
}

func (r *InMemoryWebhookRepository) Delete(ctx context.Context, projectID, webhookID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	h, ok := r.hooks[webhookID]
	if !ok || h.ProjectID != projectID {
		return domain.NewWebhookNotFoundError()
	}
	delete(r.hooks, webhookID)
	return nil
}

type InMemoryWebhookDeliveryRepository struct {
	mu         sync.RWMutex
	deliveries map[string]*domain.WebhookDelivery
}

func NewInMemoryWebhookDeliveryRepository() *InMemoryWebhookDeliveryRepository {
	return &InMemoryWebhookDeliveryRepository{
		deliveries: make(map[string]*domain.WebhookDelivery),
	}
}

func (r *InMemoryWebhookDeliveryRepository) Create(ctx context.Context, delivery *domain.WebhookDelivery) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cpy := *delivery
	r.deliveries[delivery.ID] = &cpy
	return nil
}

func (r *InMemoryWebhookDeliveryRepository) FindByID(ctx context.Context, projectID, deliveryID string) (*domain.WebhookDelivery, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	d, ok := r.deliveries[deliveryID]
	if !ok || d.ProjectID != projectID {
		return nil, domain.NewDeliveryNotFoundError()
	}
	cpy := *d
	return &cpy, nil
}

func (r *InMemoryWebhookDeliveryRepository) ListByWebhook(ctx context.Context, webhookID string, status string, limit int, cursor string) ([]*domain.WebhookDelivery, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var list []*domain.WebhookDelivery
	for _, d := range r.deliveries {
		if d.WebhookID != webhookID {
			continue
		}
		if status != "" && d.Status != status {
			continue
		}
		if cursor != "" {
			cursorTime, err := time.Parse(time.RFC3339Nano, cursor)
			if err == nil && !d.CreatedAt.Before(cursorTime) {
				continue
			}
		}
		cpy := *d
		list = append(list, &cpy)
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})

	if len(list) > limit {
		list = list[:limit]
	}
	return list, nil
}

func (r *InMemoryWebhookDeliveryRepository) Update(ctx context.Context, delivery *domain.WebhookDelivery) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.deliveries[delivery.ID]
	if !ok {
		return domain.NewDeliveryNotFoundError()
	}
	cpy := *delivery
	r.deliveries[delivery.ID] = &cpy
	return nil
}
