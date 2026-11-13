package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
)

// ProjectRepository defines persistence and concurrency operations for Projects.
type ProjectRepository interface {
	CreateWithLimitCheck(ctx context.Context, project *domain.Project) error
	FindByID(ctx context.Context, orgID, projectID string) (*domain.Project, error)
	FindOnlyByID(ctx context.Context, projectID string) (*domain.Project, error)
	FindBySlug(ctx context.Context, orgID, slug string) (*domain.Project, error)
	ListByOrg(ctx context.Context, orgID string) ([]*domain.Project, error)
	Update(ctx context.Context, project *domain.Project) error
	Delete(ctx context.Context, orgID, projectID string) error
	CountByOrg(ctx context.Context, orgID string) (int64, error)
}

// GormProjectRepository implements ProjectRepository backed by PostgreSQL/GORM.
type GormProjectRepository struct {
	db *database.DB
}

// NewProjectRepository instantiates a GORM-backed project repository.
func NewProjectRepository(db *database.DB) *GormProjectRepository {
	return &GormProjectRepository{db: db}
}

// CreateWithLimitCheck creates a project enforcing the max-5 limit per organization via advisory lock.
func (r *GormProjectRepository) CreateWithLimitCheck(ctx context.Context, project *domain.Project) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Acquire PostgreSQL transaction-level advisory lock on org ID to serialize limit verification
		if r.db.Dialector.Name() == "postgres" {
			if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", fmt.Sprintf("org_proj_limit:%s", project.OrgID)).Error; err != nil {
				return err
			}
		}

		// Verify that the organization currently has fewer than 5 active projects
		var activeCount int64
		err := tx.Model(&domain.Project{}).
			Where("org_id = ? AND deleted_at IS NULL", project.OrgID).
			Count(&activeCount).Error
		if err != nil {
			return err
		}

		if activeCount >= 5 {
			return domain.NewProjectLimitReachedError()
		}

		// Ensure slug uniqueness among non-deleted projects in this organization
		normalizedSlug := strings.ToLower(strings.TrimSpace(project.Slug))
		var existing domain.Project
		if err := tx.Where("org_id = ? AND LOWER(slug) = ? AND deleted_at IS NULL", project.OrgID, normalizedSlug).First(&existing).Error; err == nil {
			return domain.NewConflictError(domain.ErrCodeSlugTaken, "A project with this slug already exists in this organization")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if project.ID == "" {
			newID, err := uuid.NewV7()
			if err != nil {
				project.ID = uuid.NewString()
			} else {
				project.ID = newID.String()
			}
		}
		project.Slug = normalizedSlug
		if project.VerificationStatus == "" {
			project.VerificationStatus = domain.StatusUnverified
		}
		if project.Environment == "" {
			project.Environment = domain.EnvProduction
		}

		return tx.Create(project).Error
	})
}

// FindByID retrieves a project within an organization by its ID.
func (r *GormProjectRepository) FindByID(ctx context.Context, orgID, projectID string) (*domain.Project, error) {
	var project domain.Project
	err := r.db.WithContext(ctx).
		Where("id = ? AND org_id = ? AND deleted_at IS NULL", projectID, orgID).
		First(&project).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewProjectNotFoundError()
		}
		return nil, err
	}
	return &project, nil
}

// FindOnlyByID retrieves a project by its primary key ID regardless of org.
func (r *GormProjectRepository) FindOnlyByID(ctx context.Context, projectID string) (*domain.Project, error) {
	var project domain.Project
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", projectID).
		First(&project).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewProjectNotFoundError()
		}
		return nil, err
	}
	return &project, nil
}

// FindBySlug retrieves a project within an organization by its unique slug.
func (r *GormProjectRepository) FindBySlug(ctx context.Context, orgID, slug string) (*domain.Project, error) {
	var project domain.Project
	err := r.db.WithContext(ctx).
		Where("org_id = ? AND LOWER(slug) = ? AND deleted_at IS NULL", orgID, strings.ToLower(slug)).
		First(&project).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.NewProjectNotFoundError()
		}
		return nil, err
	}
	return &project, nil
}

// ListByOrg returns up to 5 non-deleted projects for an organization.
func (r *GormProjectRepository) ListByOrg(ctx context.Context, orgID string) ([]*domain.Project, error) {
	var projects []*domain.Project
	err := r.db.WithContext(ctx).
		Where("org_id = ? AND deleted_at IS NULL", orgID).
		Order("created_at ASC").
		Find(&projects).Error
	if err != nil {
		return nil, err
	}
	return projects, nil
}

// Update persists changes to a project.
func (r *GormProjectRepository) Update(ctx context.Context, project *domain.Project) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Verify project exists in the org
		var current domain.Project
		if err := tx.Where("id = ? AND org_id = ? AND deleted_at IS NULL", project.ID, project.OrgID).First(&current).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domain.NewProjectNotFoundError()
			}
			return err
		}

		return tx.Model(project).Where("id = ? AND org_id = ?", project.ID, project.OrgID).Updates(map[string]interface{}{
			"name":                project.Name,
			"description":         project.Description,
			"base_url":            project.BaseURL,
			"environment":         project.Environment,
			"verification_status": project.VerificationStatus,
			"verified_at":         project.VerifiedAt,
		}).Error
	})
}

// Delete soft-deletes a project within an organization.
func (r *GormProjectRepository) Delete(ctx context.Context, orgID, projectID string) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND org_id = ? AND deleted_at IS NULL", projectID, orgID).
		Delete(&domain.Project{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.NewProjectNotFoundError()
	}
	return nil
}

// CountByOrg returns the number of active projects in an organization.
func (r *GormProjectRepository) CountByOrg(ctx context.Context, orgID string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&domain.Project{}).
		Where("org_id = ? AND deleted_at IS NULL", orgID).
		Count(&count).Error
	return count, err
}
