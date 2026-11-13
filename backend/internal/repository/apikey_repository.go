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

// APIKeyRepository defines persistence operations for programmatic API credentials.
type APIKeyRepository interface {
	Create(ctx context.Context, key *domain.APIKey) error
	FindByID(ctx context.Context, projectID, keyID string) (*domain.APIKey, error)
	FindByHash(ctx context.Context, keyHash string) (*domain.APIKey, error)
	ListByProject(ctx context.Context, projectID string) ([]*domain.APIKey, error)
	Update(ctx context.Context, key *domain.APIKey) error
	Revoke(ctx context.Context, projectID, keyID string, revokedAt time.Time) error
	UpdateLastUsed(ctx context.Context, keyID string, lastUsedAt time.Time) error
}

// --- GORM Implementation ---

type GormAPIKeyRepository struct {
	db *database.DB
}

func NewAPIKeyRepository(db *database.DB) *GormAPIKeyRepository {
	return &GormAPIKeyRepository{db: db}
}

func (r *GormAPIKeyRepository) Create(ctx context.Context, key *domain.APIKey) error {
	return r.db.WithContext(ctx).Create(key).Error
}

func (r *GormAPIKeyRepository) FindByID(ctx context.Context, projectID, keyID string) (*domain.APIKey, error) {
	var key domain.APIKey
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", keyID, projectID).
		First(&key).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewAPIKeyNotFoundError()
		}
		return nil, domain.NewInternalError(err)
	}
	return &key, nil
}

func (r *GormAPIKeyRepository) FindByHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	var key domain.APIKey
	err := r.db.WithContext(ctx).
		Where("key_hash = ?", keyHash).
		First(&key).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewAPIKeyNotFoundError()
		}
		return nil, domain.NewInternalError(err)
	}
	return &key, nil
}

func (r *GormAPIKeyRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.APIKey, error) {
	var keys []*domain.APIKey
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at desc").
		Find(&keys).Error
	if err != nil {
		return nil, domain.NewInternalError(err)
	}
	return keys, nil
}

func (r *GormAPIKeyRepository) Update(ctx context.Context, key *domain.APIKey) error {
	res := r.db.WithContext(ctx).Save(key)
	if res.Error != nil {
		return domain.NewInternalError(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.NewAPIKeyNotFoundError()
	}
	return nil
}

func (r *GormAPIKeyRepository) Revoke(ctx context.Context, projectID, keyID string, revokedAt time.Time) error {
	res := r.db.WithContext(ctx).
		Model(&domain.APIKey{}).
		Where("id = ? AND project_id = ? AND revoked_at IS NULL", keyID, projectID).
		Update("revoked_at", revokedAt)
	if res.Error != nil {
		return domain.NewInternalError(res.Error)
	}
	if res.RowsAffected == 0 {
		return domain.NewAPIKeyNotFoundError()
	}
	return nil
}

func (r *GormAPIKeyRepository) UpdateLastUsed(ctx context.Context, keyID string, lastUsedAt time.Time) error {
	return r.db.WithContext(ctx).
		Model(&domain.APIKey{}).
		Where("id = ?", keyID).
		Update("last_used_at", lastUsedAt).Error
}

// --- In-Memory Implementation for fast unit testing ---

type InMemoryAPIKeyRepository struct {
	mu   sync.RWMutex
	keys map[string]*domain.APIKey
}

func NewInMemoryAPIKeyRepository() *InMemoryAPIKeyRepository {
	return &InMemoryAPIKeyRepository{
		keys: make(map[string]*domain.APIKey),
	}
}

func (r *InMemoryAPIKeyRepository) Create(ctx context.Context, key *domain.APIKey) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	cpy := *key
	r.keys[key.ID] = &cpy
	return nil
}

func (r *InMemoryAPIKeyRepository) FindByID(ctx context.Context, projectID, keyID string) (*domain.APIKey, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	k, ok := r.keys[keyID]
	if !ok || k.ProjectID != projectID {
		return nil, domain.NewAPIKeyNotFoundError()
	}
	cpy := *k
	return &cpy, nil
}

func (r *InMemoryAPIKeyRepository) FindByHash(ctx context.Context, keyHash string) (*domain.APIKey, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, k := range r.keys {
		if k.KeyHash == keyHash {
			cpy := *k
			return &cpy, nil
		}
	}
	return nil, domain.NewAPIKeyNotFoundError()
}

func (r *InMemoryAPIKeyRepository) ListByProject(ctx context.Context, projectID string) ([]*domain.APIKey, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*domain.APIKey
	for _, k := range r.keys {
		if k.ProjectID == projectID {
			cpy := *k
			list = append(list, &cpy)
		}
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})

	return list, nil
}

func (r *InMemoryAPIKeyRepository) Update(ctx context.Context, key *domain.APIKey) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	k, ok := r.keys[key.ID]
	if !ok || k.ProjectID != key.ProjectID {
		return domain.NewAPIKeyNotFoundError()
	}
	cpy := *key
	r.keys[key.ID] = &cpy
	return nil
}

func (r *InMemoryAPIKeyRepository) Revoke(ctx context.Context, projectID, keyID string, revokedAt time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	k, ok := r.keys[keyID]
	if !ok || k.ProjectID != projectID {
		return domain.NewAPIKeyNotFoundError()
	}
	k.RevokedAt = &revokedAt
	return nil
}

func (r *InMemoryAPIKeyRepository) UpdateLastUsed(ctx context.Context, keyID string, lastUsedAt time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	k, ok := r.keys[keyID]
	if !ok {
		return domain.NewAPIKeyNotFoundError()
	}
	k.LastUsedAt = &lastUsedAt
	return nil
}
