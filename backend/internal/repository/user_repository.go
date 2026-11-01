package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound = errors.New("user not found")
)

// UserRepository defines database operations for users.
type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	FindByID(ctx context.Context, id string) (*domain.User, error)
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	FindByUsername(ctx context.Context, username string) (*domain.User, error)
	FindByOAuth(ctx context.Context, provider, providerUserID string) (*domain.User, error)
	Update(ctx context.Context, user *domain.User) error
	UpdatePassword(ctx context.Context, userID, newPasswordHash string) error
	SetVerified(ctx context.Context, userID string) error
	SetUsername(ctx context.Context, userID, username string) error
	LinkOAuth(ctx context.Context, userID, provider, providerUserID string) error
}

type GormUserRepository struct {
	db *database.DB
}

// NewUserRepository instantiates a GORM-backed user repository.
func NewUserRepository(db *database.DB) *GormUserRepository {
	return &GormUserRepository{db: db}
}

func (r *GormUserRepository) Create(ctx context.Context, user *domain.User) error {
	user.Email = strings.ToLower(strings.TrimSpace(user.Email))
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *GormUserRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *GormUserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if err := r.db.WithContext(ctx).First(&user, "LOWER(email) = ?", normalizedEmail).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *GormUserRepository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	var user domain.User
	normalizedUsername := strings.ToLower(strings.TrimSpace(username))
	if err := r.db.WithContext(ctx).First(&user, "LOWER(username) = ?", normalizedUsername).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *GormUserRepository) Update(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

func (r *GormUserRepository) UpdatePassword(ctx context.Context, userID, newPasswordHash string) error {
	return r.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"password_hash": newPasswordHash,
			"updated_at":    time.Now().UTC(),
		}).Error
}

func (r *GormUserRepository) SetVerified(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"is_verified": true,
			"updated_at":  time.Now().UTC(),
		}).Error
}

func (r *GormUserRepository) SetUsername(ctx context.Context, userID, username string) error {
	res := r.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ? AND username IS NULL", userID).
		Updates(map[string]interface{}{
			"username":   username,
			"updated_at": time.Now().UTC(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.NewUsernameAlreadySetError()
	}
	return nil
}

func (r *GormUserRepository) FindByOAuth(ctx context.Context, provider, providerUserID string) (*domain.User, error) {
	var user domain.User
	if err := r.db.WithContext(ctx).First(&user, "oauth_provider = ? AND oauth_provider_id = ?", provider, providerUserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &user, nil
}

func (r *GormUserRepository) LinkOAuth(ctx context.Context, userID, provider, providerUserID string) error {
	return r.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"oauth_provider":    provider,
			"oauth_provider_id": providerUserID,
			"is_verified":       true,
			"updated_at":        time.Now().UTC(),
		}).Error
}
