package repository

import (
	"context"
	"errors"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

var (
	ErrRefreshTokenNotFound = errors.New("refresh token not found")
)

// AuthRepository defines database operations for session management.
type AuthRepository interface {
	CreateRefreshToken(ctx context.Context, token *domain.RefreshToken) error
	FindRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, tokenHash, replacedBy string) error
	RevokeFamily(ctx context.Context, familyID string) error
	RevokeAllUserSessions(ctx context.Context, userID string) error
	RevokeSession(ctx context.Context, sessionID, userID string) error
	ListActiveSessions(ctx context.Context, userID string) ([]domain.RefreshToken, error)
}

type GormAuthRepository struct {
	db *database.DB
}

// NewAuthRepository creates a new GORM-backed session and token repository.
func NewAuthRepository(db *database.DB) *GormAuthRepository {
	return &GormAuthRepository{db: db}
}

func (r *GormAuthRepository) CreateRefreshToken(ctx context.Context, token *domain.RefreshToken) error {
	return r.db.WithContext(ctx).Create(token).Error
}

func (r *GormAuthRepository) FindRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error) {
	var token domain.RefreshToken
	if err := r.db.WithContext(ctx).First(&token, "token_hash = ?", tokenHash).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRefreshTokenNotFound
		}
		return nil, err
	}
	return &token, nil
}

func (r *GormAuthRepository) RevokeRefreshToken(ctx context.Context, tokenHash, replacedBy string) error {
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"revoked_at": now,
	}
	if replacedBy != "" {
		updates["replaced_by"] = replacedBy
	}
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("token_hash = ?", tokenHash).
		Updates(updates).Error
}

// RevokeFamily invalidates all tokens in a family when reuse is detected.
func (r *GormAuthRepository) RevokeFamily(ctx context.Context, familyID string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("family_id = ? AND revoked_at IS NULL", familyID).
		Update("revoked_at", now).Error
}

// RevokeAllUserSessions revokes all active sessions for a user (e.g. on password reset).
func (r *GormAuthRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", now).Error
}

// RevokeSession revokes a specific session identified by ID.
func (r *GormAuthRepository) RevokeSession(ctx context.Context, sessionID, userID string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("id = ? AND user_id = ? AND revoked_at IS NULL", sessionID, userID).
		Update("revoked_at", now).Error
}

// ListActiveSessions returns valid, unrevoked sessions for a user.
func (r *GormAuthRepository) ListActiveSessions(ctx context.Context, userID string) ([]domain.RefreshToken, error) {
	var tokens []domain.RefreshToken
	now := time.Now().UTC()
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND revoked_at IS NULL AND expires_at > ?", userID, now).
		Order("created_at DESC").
		Find(&tokens).Error
	if err != nil {
		return nil, err
	}
	return tokens, nil
}
