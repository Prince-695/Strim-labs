package repository

import (
	"context"
	"errors"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

var (
	ErrOAuthAccountNotFound = errors.New("oauth account not found")
)

// OAuthRepository defines database operations for social authentication accounts.
type OAuthRepository interface {
	FindByProvider(ctx context.Context, provider, providerUserID string) (*domain.OAuthAccount, error)
	Create(ctx context.Context, account *domain.OAuthAccount) error
}

type GormOAuthRepository struct {
	db *database.DB
}

// NewOAuthRepository creates a GORM-backed OAuth repository.
func NewOAuthRepository(db *database.DB) *GormOAuthRepository {
	return &GormOAuthRepository{db: db}
}

func (r *GormOAuthRepository) FindByProvider(ctx context.Context, provider, providerUserID string) (*domain.OAuthAccount, error) {
	var account domain.OAuthAccount
	err := r.db.WithContext(ctx).
		First(&account, "provider = ? AND provider_user_id = ?", provider, providerUserID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOAuthAccountNotFound
		}
		return nil, err
	}
	return &account, nil
}

func (r *GormOAuthRepository) Create(ctx context.Context, account *domain.OAuthAccount) error {
	return r.db.WithContext(ctx).Create(account).Error
}
