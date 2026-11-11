package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
)

// VerificationRepository defines operations for project domain verifications.
type VerificationRepository interface {
	Create(ctx context.Context, verification *domain.ProjectVerification) error
	FindActiveByProject(ctx context.Context, projectID string) (*domain.ProjectVerification, error)
	Update(ctx context.Context, verification *domain.ProjectVerification) error
	UpdateProjectVerificationStatus(ctx context.Context, projectID string, status domain.VerificationStatus, verifiedAt *time.Time) error
}

// GormVerificationRepository implements VerificationRepository with GORM.
type GormVerificationRepository struct {
	db *database.DB
}

// NewVerificationRepository instantiates a GORM verification repository.
func NewVerificationRepository(db *database.DB) *GormVerificationRepository {
	return &GormVerificationRepository{db: db}
}

// Create inserts a domain verification record.
func (r *GormVerificationRepository) Create(ctx context.Context, verification *domain.ProjectVerification) error {
	if verification.ID == "" {
		newID, err := uuid.NewV7()
		if err != nil {
			verification.ID = uuid.NewString()
		} else {
			verification.ID = newID.String()
		}
	}
	return r.db.WithContext(ctx).Create(verification).Error
}

// FindActiveByProject retrieves the most recent active or pending verification for a project.
func (r *GormVerificationRepository) FindActiveByProject(ctx context.Context, projectID string) (*domain.ProjectVerification, error) {
	var v domain.ProjectVerification
	err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		First(&v).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

// Update persists status and checked_at timestamp on a verification record.
func (r *GormVerificationRepository) Update(ctx context.Context, verification *domain.ProjectVerification) error {
	return r.db.WithContext(ctx).Model(verification).
		Where("id = ?", verification.ID).
		Updates(map[string]interface{}{
			"status":     verification.Status,
			"checked_at": verification.CheckedAt,
		}).Error
}

// UpdateProjectVerificationStatus updates the parent project's verification state.
func (r *GormVerificationRepository) UpdateProjectVerificationStatus(ctx context.Context, projectID string, status domain.VerificationStatus, verifiedAt *time.Time) error {
	updates := map[string]interface{}{
		"verification_status": status,
		"verified_at":         verifiedAt,
	}
	return r.db.WithContext(ctx).Model(&domain.Project{}).
		Where("id = ? AND deleted_at IS NULL", projectID).
		Updates(updates).Error
}
