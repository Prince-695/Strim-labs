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
	ErrOTPNotFound = errors.New("active OTP code not found")
)

// OTPRepository defines database operations for one-time verification tokens.
type OTPRepository interface {
	CreateOTP(ctx context.Context, otp *domain.OTP) error
	FindLatestActive(ctx context.Context, email, purpose string) (*domain.OTP, error)
	IncrementAttempts(ctx context.Context, otpID string) (int, error)
	MarkUsed(ctx context.Context, otpID string) error
}

type GormOTPRepository struct {
	db *database.DB
}

// NewOTPRepository creates a GORM-backed OTP repository.
func NewOTPRepository(db *database.DB) *GormOTPRepository {
	return &GormOTPRepository{db: db}
}

func (r *GormOTPRepository) CreateOTP(ctx context.Context, otp *domain.OTP) error {
	otp.Email = strings.ToLower(strings.TrimSpace(otp.Email))
	return r.db.WithContext(ctx).Create(otp).Error
}

func (r *GormOTPRepository) FindLatestActive(ctx context.Context, email, purpose string) (*domain.OTP, error) {
	var otp domain.OTP
	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	now := time.Now().UTC()

	err := r.db.WithContext(ctx).
		Where("LOWER(email) = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?", normalizedEmail, purpose, now).
		Order("created_at DESC").
		First(&otp).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOTPNotFound
		}
		return nil, err
	}
	return &otp, nil
}

func (r *GormOTPRepository) IncrementAttempts(ctx context.Context, otpID string) (int, error) {
	var otp domain.OTP
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&otp, "id = ?", otpID).Error; err != nil {
			return err
		}
		otp.Attempts++
		return tx.Model(&otp).Update("attempts", otp.Attempts).Error
	})
	if err != nil {
		return 0, err
	}
	return otp.Attempts, nil
}

func (r *GormOTPRepository) MarkUsed(ctx context.Context, otpID string) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).Model(&domain.OTP{}).
		Where("id = ? AND used_at IS NULL", otpID).
		Update("used_at", now).Error
}
