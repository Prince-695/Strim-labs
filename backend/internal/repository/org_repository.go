package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrOrgNotFound = errors.New("organization not found")
)

// OrgRepository defines persistence operations for organizations.
type OrgRepository interface {
	CreateWithLimitCheck(ctx context.Context, org *domain.Organization, ownerUserID string) error
	FindByID(ctx context.Context, id string) (*domain.Organization, error)
	FindBySlug(ctx context.Context, slug string) (*domain.Organization, error)
	ListByUser(ctx context.Context, userID string) ([]*domain.Organization, error)
	Update(ctx context.Context, org *domain.Organization) error
	SoftDelete(ctx context.Context, id string) error
	WithTenantContext(ctx context.Context, orgID string, fn func(tx *gorm.DB) error) error
}

type GormOrgRepository struct {
	db *database.DB
}

// NewOrgRepository instantiates a GORM-backed organization repository.
func NewOrgRepository(db *database.DB) *GormOrgRepository {
	return &GormOrgRepository{db: db}
}

// CreateWithLimitCheck creates an organization and assigns the caller as owner within an advisory lock transaction.
func (r *GormOrgRepository) CreateWithLimitCheck(ctx context.Context, org *domain.Organization, ownerUserID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Acquire PostgreSQL transaction-level advisory lock on owner user ID to serialize limit verification
		if r.db.Dialector.Name() == "postgres" {
			if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", fmt.Sprintf("user_org_limit:%s", ownerUserID)).Error; err != nil {
				return err
			}
		}

		// Verify that the user currently belongs to fewer than 3 active organizations
		var activeCount int64
		err := tx.Table("org_members").
			Joins("JOIN organizations ON organizations.id = org_members.org_id").
			Where("org_members.user_id = ? AND organizations.deleted_at IS NULL", ownerUserID).
			Count(&activeCount).Error
		if err != nil {
			return err
		}

		if activeCount >= 3 {
			return domain.NewOrgLimitReachedError()
		}

		// Ensure slug uniqueness among non-deleted organizations
		normalizedSlug := strings.ToLower(strings.TrimSpace(org.Slug))
		var existing domain.Organization
		if err := tx.Where("LOWER(slug) = ? AND deleted_at IS NULL", normalizedSlug).First(&existing).Error; err == nil {
			return domain.NewSlugTakenError()
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if org.ID == "" {
			newID, err := uuid.NewV7()
			if err != nil {
				org.ID = uuid.NewString()
			} else {
				org.ID = newID.String()
			}
		}
		org.Slug = normalizedSlug
		org.CreatedBy = ownerUserID

		if err := tx.Create(org).Error; err != nil {
			return err
		}

		// Add creator as initial Owner
		ownerMember := &domain.OrgMember{
			OrgID:    org.ID,
			UserID:   ownerUserID,
			Role:     domain.RoleOwner,
			JoinedAt: time.Now().UTC(),
		}
		if err := tx.Create(ownerMember).Error; err != nil {
			return err
		}

		org.Role = domain.RoleOwner
		org.MemberCount = 1
		org.ProjectCount = 0

		return nil
	})
}

// FindByID retrieves an active organization by its UUID.
func (r *GormOrgRepository) FindByID(ctx context.Context, id string) (*domain.Organization, error) {
	var org domain.Organization
	if err := r.db.WithContext(ctx).First(&org, "id = ? AND deleted_at IS NULL", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrgNotFound
		}
		return nil, err
	}

	var mCount int64
	_ = r.db.WithContext(ctx).Table("org_members").Where("org_id = ?", id).Count(&mCount)
	org.MemberCount = int(mCount)
	org.ProjectCount = 0

	return &org, nil
}

// FindBySlug retrieves an active organization by slug.
func (r *GormOrgRepository) FindBySlug(ctx context.Context, slug string) (*domain.Organization, error) {
	var org domain.Organization
	normalizedSlug := strings.ToLower(strings.TrimSpace(slug))
	if err := r.db.WithContext(ctx).First(&org, "LOWER(slug) = ? AND deleted_at IS NULL", normalizedSlug).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrOrgNotFound
		}
		return nil, err
	}

	var mCount int64
	_ = r.db.WithContext(ctx).Table("org_members").Where("org_id = ?", org.ID).Count(&mCount)
	org.MemberCount = int(mCount)
	org.ProjectCount = 0

	return &org, nil
}

// ListByUser retrieves all active organizations a user belongs to, including their role and member counts.
func (r *GormOrgRepository) ListByUser(ctx context.Context, userID string) ([]*domain.Organization, error) {
	type orgRow struct {
		domain.Organization
		MemberRole  string `gorm:"column:member_role"`
		MemberCount int    `gorm:"column:member_count"`
	}

	var rows []orgRow
	err := r.db.WithContext(ctx).
		Table("organizations").
		Select("organizations.*, org_members.role AS member_role, (SELECT COUNT(*) FROM org_members om WHERE om.org_id = organizations.id) AS member_count").
		Joins("JOIN org_members ON org_members.org_id = organizations.id").
		Where("org_members.user_id = ? AND organizations.deleted_at IS NULL", userID).
		Order("organizations.created_at ASC").
		Limit(3).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	orgs := make([]*domain.Organization, len(rows))
	for i := range rows {
		item := rows[i].Organization
		item.Role = domain.OrgRole(rows[i].MemberRole)
		item.MemberCount = rows[i].MemberCount
		item.ProjectCount = 0
		orgs[i] = &item
	}

	return orgs, nil
}

// Update persists modifications to an organization's name and description.
func (r *GormOrgRepository) Update(ctx context.Context, org *domain.Organization) error {
	return r.db.WithContext(ctx).Model(&domain.Organization{}).
		Where("id = ? AND deleted_at IS NULL", org.ID).
		Updates(map[string]interface{}{
			"name":        org.Name,
			"description": org.Description,
			"updated_at":  time.Now().UTC(),
		}).Error
}

// SoftDelete marks an organization as deleted.
func (r *GormOrgRepository) SoftDelete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).
		Where("id = ?", id).
		Delete(&domain.Organization{}).Error
}

// WithTenantContext runs queries within a PostgreSQL transaction configuring 'app.current_org_id'.
func (r *GormOrgRepository) WithTenantContext(ctx context.Context, orgID string, fn func(tx *gorm.DB) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if r.db.Dialector.Name() == "postgres" {
			if err := tx.Exec("SET LOCAL app.current_org_id = ?", orgID).Error; err != nil {
				return err
			}
		}
		return fn(tx)
	})
}
