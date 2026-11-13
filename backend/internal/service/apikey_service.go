package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/repository"
)

type cachedKey struct {
	key      *domain.APIKey
	cachedAt time.Time
}

// APIKeyService handles lifecycle, hashing, scoped validation, and rotation of project API keys.
type APIKeyService struct {
	keyRepo     repository.APIKeyRepository
	projectRepo repository.ProjectRepository
	auditRec    audit.Recorder
	idGen       ids.IDGenerator
	cache       sync.Map // hash string -> cachedKey
	cacheTTL    time.Duration
}

// NewAPIKeyService initializes an APIKeyService.
func NewAPIKeyService(
	keyRepo repository.APIKeyRepository,
	projectRepo repository.ProjectRepository,
	auditRec audit.Recorder,
) *APIKeyService {
	return &APIKeyService{
		keyRepo:     keyRepo,
		projectRepo: projectRepo,
		auditRec:    auditRec,
		idGen:       ids.NewUUIDv7Generator(),
		cacheTTL:    5 * time.Minute,
	}
}

// CreateKey generates a cryptographically secure API key, records its hash, and returns the raw secret once.
func (s *APIKeyService) CreateKey(ctx context.Context, orgID, projectID string, req *domain.CreateAPIKeyRequest) (*domain.APIKeyResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	if appErr := req.Validate(); appErr != nil {
		return nil, appErr
	}

	rawSecret, prefix, err := s.generateKeySecret()
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	keyHash := domain.HashSecret(rawSecret)
	now := time.Now()
	key := &domain.APIKey{
		ID:        s.idGen.MustNewUUIDv7(),
		ProjectID: projectID,
		OrgID:     orgID,
		Name:      req.Name,
		Prefix:    prefix,
		KeyHash:   keyHash,
		Scopes:    req.Scopes,
		ExpiresAt: req.ExpiresAt,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.keyRepo.Create(ctx, key); err != nil {
		return nil, err
	}

	s.cache.Store(keyHash, cachedKey{key: key, cachedAt: now})

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "api_key.created", "api_key", key.ID, nil, map[string]interface{}{
			"name":   key.Name,
			"prefix": key.Prefix,
			"scopes": key.Scopes,
		})
	}

	resp := domain.ToAPIKeyResponse(key, rawSecret)
	return &resp, nil
}

// ListKeys returns all API keys for a project with secrets omitted.
func (s *APIKeyService) ListKeys(ctx context.Context, orgID, projectID string) ([]domain.APIKeyResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	keys, err := s.keyRepo.ListByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	resp := make([]domain.APIKeyResponse, 0, len(keys))
	for _, k := range keys {
		resp = append(resp, domain.ToAPIKeyResponse(k, ""))
	}
	return resp, nil
}

// RotateKey creates a new secret while keeping the old key active during an optional grace period.
func (s *APIKeyService) RotateKey(ctx context.Context, orgID, projectID, keyID string, req *domain.RotateAPIKeyRequest) (*domain.APIKeyResponse, error) {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return nil, err
	}

	oldKey, err := s.keyRepo.FindByID(ctx, projectID, keyID)
	if err != nil {
		return nil, err
	}

	graceHours := 24
	if req != nil && req.GraceHours != nil && *req.GraceHours >= 0 {
		graceHours = *req.GraceHours
	}

	now := time.Now()
	graceUntil := now.Add(time.Duration(graceHours) * time.Hour)
	oldKey.GraceUntil = &graceUntil
	oldKey.UpdatedAt = now

	if err := s.keyRepo.Update(ctx, oldKey); err != nil {
		return nil, err
	}
	s.cache.Delete(oldKey.KeyHash)

	// Issue new replacement key
	rawSecret, prefix, err := s.generateKeySecret()
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	newKeyHash := domain.HashSecret(rawSecret)
	newKey := &domain.APIKey{
		ID:        s.idGen.MustNewUUIDv7(),
		ProjectID: projectID,
		OrgID:     orgID,
		Name:      oldKey.Name,
		Prefix:    prefix,
		KeyHash:   newKeyHash,
		Scopes:    oldKey.Scopes,
		ExpiresAt: oldKey.ExpiresAt,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.keyRepo.Create(ctx, newKey); err != nil {
		return nil, err
	}
	s.cache.Store(newKeyHash, cachedKey{key: newKey, cachedAt: now})

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "api_key.rotated", "api_key", newKey.ID, map[string]interface{}{
			"old_key_id":  oldKey.ID,
			"grace_until": graceUntil,
		}, map[string]interface{}{
			"new_key_id": newKey.ID,
			"prefix":     newKey.Prefix,
		})
	}

	resp := domain.ToAPIKeyResponse(newKey, rawSecret)
	return &resp, nil
}

// RevokeKey immediately disables an API key.
func (s *APIKeyService) RevokeKey(ctx context.Context, orgID, projectID, keyID string) error {
	if _, err := s.projectRepo.FindByID(ctx, orgID, projectID); err != nil {
		return err
	}

	key, err := s.keyRepo.FindByID(ctx, projectID, keyID)
	if err != nil {
		return err
	}

	now := time.Now()
	if err := s.keyRepo.Revoke(ctx, projectID, keyID, now); err != nil {
		return err
	}

	s.cache.Delete(key.KeyHash)

	if s.auditRec != nil {
		s.auditRec.RecordFromContext(ctx, orgID, "api_key.revoked", "api_key", keyID, map[string]interface{}{
			"prefix": key.Prefix,
		}, nil)
	}

	return nil
}

// ValidateKey validates an incoming raw secret, enforces scopes, updates last_used_at, and uses caching.
func (s *APIKeyService) ValidateKey(ctx context.Context, rawSecret string, requiredScope domain.APIKeyScope) (*domain.APIKey, error) {
	if rawSecret == "" {
		return nil, domain.NewUnauthorizedError("API key required")
	}

	keyHash := domain.HashSecret(rawSecret)
	now := time.Now()

	// 1. Check cache
	if val, ok := s.cache.Load(keyHash); ok {
		entry := val.(cachedKey)
		if now.Sub(entry.cachedAt) < s.cacheTTL {
			if !entry.key.IsActive(now) {
				s.cache.Delete(keyHash)
				return nil, domain.NewAPIKeyRevokedError()
			}
			if requiredScope != "" && !entry.key.HasScope(requiredScope) {
				return nil, domain.NewForbiddenError(domain.ErrCodeKeyScopeMissing, "API key lacks required scope")
			}
			go func(kID string) {
				_ = s.keyRepo.UpdateLastUsed(context.Background(), kID, time.Now())
			}(entry.key.ID)
			return entry.key, nil
		}
	}

	// 2. Query repository
	key, err := s.keyRepo.FindByHash(ctx, keyHash)
	if err != nil {
		return nil, domain.NewUnauthorizedError("Invalid API key")
	}

	if !key.IsActive(now) {
		return nil, domain.NewAPIKeyRevokedError()
	}

	if requiredScope != "" && !key.HasScope(requiredScope) {
		return nil, domain.NewForbiddenError(domain.ErrCodeKeyScopeMissing, "API key lacks required scope")
	}

	s.cache.Store(keyHash, cachedKey{key: key, cachedAt: now})

	go func(kID string) {
		_ = s.keyRepo.UpdateLastUsed(context.Background(), kID, time.Now())
	}(key.ID)

	return key, nil
}

func (s *APIKeyService) generateKeySecret() (rawSecret string, prefix string, err error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", err
	}
	hexStr := hex.EncodeToString(bytes)
	rawSecret = fmt.Sprintf("strim_live_%s", hexStr)
	prefix = fmt.Sprintf("strim_live_%s", hexStr[:8])
	return rawSecret, prefix, nil
}
