package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"gorm.io/gorm"
)

var (
	ErrMemberNotFound = errors.New("member not found")
)

// MemberRepository defines persistence operations for organization memberships and roles.
type MemberRepository interface {
	AddMemberWithLimitCheck(ctx context.Context, member *domain.OrgMember) error
	FindMember(ctx context.Context, orgID, userID string) (*domain.OrgMember, error)
	ListMembers(ctx context.Context, orgID string, query domain.ListMembersQuery) ([]*domain.OrgMemberDetailResponse, error)
	UpdateRole(ctx context.Context, orgID, userID string, newRole domain.OrgRole) error
	RemoveMember(ctx context.Context, orgID, userID string) error
	CountOwners(ctx context.Context, orgID string) (int, error)
	CountUserOrgs(ctx context.Context, userID string) (int, error)
}

type GormMemberRepository struct {
	db *database.DB
}

// NewMemberRepository instantiates a GORM-backed member repository.
func NewMemberRepository(db *database.DB) *GormMemberRepository {
	return &GormMemberRepository{db: db}
}

// AddMemberWithLimitCheck validates that target user has < 3 active orgs under advisory lock before inserting.
func (r *GormMemberRepository) AddMemberWithLimitCheck(ctx context.Context, member *domain.OrgMember) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Acquire PostgreSQL transaction-level advisory lock on target user ID
		if r.db.Dialector.Name() == "postgres" {
			if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", fmt.Sprintf("user_org_limit:%s", member.UserID)).Error; err != nil {
				return err
			}
		}

		// Verify target user's active org count < 3
		var activeCount int64
		err := tx.Table("org_members").
			Joins("JOIN organizations ON organizations.id = org_members.org_id").
			Where("org_members.user_id = ? AND organizations.deleted_at IS NULL", member.UserID).
			Count(&activeCount).Error
		if err != nil {
			return err
		}

		if activeCount >= 3 {
			return domain.NewTargetOrgLimitReachedError()
		}

		// Check if target user is already a member of this organization
		var existing domain.OrgMember
		if err := tx.Where("org_id = ? AND user_id = ?", member.OrgID, member.UserID).First(&existing).Error; err == nil {
			return domain.NewAlreadyMemberError()
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		return tx.Create(member).Error
	})
}

// FindMember retrieves a membership record by org ID and user ID.
func (r *GormMemberRepository) FindMember(ctx context.Context, orgID, userID string) (*domain.OrgMember, error) {
	var member domain.OrgMember
	if err := r.db.WithContext(ctx).
		Where("org_id = ? AND user_id = ?", orgID, userID).
		First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrMemberNotFound
		}
		return nil, err
	}
	return &member, nil
}

// ListMembers retrieves members for an organization matching filters.
func (r *GormMemberRepository) ListMembers(ctx context.Context, orgID string, query domain.ListMembersQuery) ([]*domain.OrgMemberDetailResponse, error) {
	dbQuery := r.db.WithContext(ctx).
		Table("org_members").
		Select("org_members.user_id, users.email, users.first_name, users.last_name, users.username, org_members.role, org_members.joined_at").
		Joins("JOIN users ON users.id = org_members.user_id").
		Where("org_members.org_id = ? AND users.deleted_at IS NULL", orgID)

	if query.Role != "" {
		dbQuery = dbQuery.Where("org_members.role = ?", query.Role)
	}

	if query.Q != "" {
		searchPattern := "%" + strings.ToLower(strings.TrimSpace(query.Q)) + "%"
		dbQuery = dbQuery.Where("(LOWER(users.first_name) LIKE ? OR LOWER(users.last_name) LIKE ? OR LOWER(users.email) LIKE ? OR LOWER(users.username) LIKE ?)",
			searchPattern, searchPattern, searchPattern, searchPattern)
	}

	limit := query.Limit
	if limit <= 0 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}

	dbQuery = dbQuery.Order("org_members.joined_at ASC").Limit(limit)

	var results []*domain.OrgMemberDetailResponse
	if err := dbQuery.Scan(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}

// UpdateRole changes the authorization tier for a member in an organization.
func (r *GormMemberRepository) UpdateRole(ctx context.Context, orgID, userID string, newRole domain.OrgRole) error {
	return r.db.WithContext(ctx).Model(&domain.OrgMember{}).
		Where("org_id = ? AND user_id = ?", orgID, userID).
		Update("role", newRole).Error
}

// RemoveMember deletes a member from an organization.
func (r *GormMemberRepository) RemoveMember(ctx context.Context, orgID, userID string) error {
	return r.db.WithContext(ctx).
		Where("org_id = ? AND user_id = ?", orgID, userID).
		Delete(&domain.OrgMember{}).Error
}

// CountOwners returns the number of active owners for an organization.
func (r *GormMemberRepository) CountOwners(ctx context.Context, orgID string) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&domain.OrgMember{}).
		Where("org_id = ? AND role = ?", orgID, domain.RoleOwner).
		Count(&count).Error
	return int(count), err
}

// CountUserOrgs returns the number of active organizations a user belongs to.
func (r *GormMemberRepository) CountUserOrgs(ctx context.Context, userID string) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).Table("org_members").
		Joins("JOIN organizations ON organizations.id = org_members.org_id").
		Where("org_members.user_id = ? AND organizations.deleted_at IS NULL", userID).
		Count(&count).Error
	return int(count), err
}
