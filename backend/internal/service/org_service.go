package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/gofiber/fiber/v2"
)

var (
	slugRegex     = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$`)
	reservedSlugs = map[string]struct{}{
		"admin": {}, "api": {}, "app": {}, "www": {}, "settings": {},
		"system": {}, "billing": {}, "auth": {}, "health": {}, "dashboard": {},
		"docs": {}, "swagger": {}, "v1": {}, "v2": {}, "strim": {},
		"strimlabs": {}, "support": {}, "status": {}, "help": {}, "oauth": {},
	}
)

type OrgService interface {
	CreateOrg(ctx context.Context, userID string, req domain.CreateOrgRequest) (*domain.OrgResponse, error)
	ListUserOrgs(ctx context.Context, userID string) ([]*domain.OrgResponse, error)
	GetOrg(ctx context.Context, orgID, userID string) (*domain.OrgResponse, error)
	UpdateOrg(ctx context.Context, orgID, userID string, req domain.UpdateOrgRequest) (*domain.OrgResponse, error)
	DeleteOrg(ctx context.Context, orgID, userID string, req domain.DeleteOrgRequest) error

	AddMember(ctx context.Context, orgID, actorUserID string, req domain.AddMemberRequest) (*domain.OrgMemberDetailResponse, error)
	ListMembers(ctx context.Context, orgID string, query domain.ListMembersQuery) ([]*domain.OrgMemberDetailResponse, error)
	UpdateMemberRole(ctx context.Context, orgID, actorUserID, targetUserID string, req domain.UpdateMemberRoleRequest) (*domain.OrgMemberDetailResponse, error)
	RemoveMember(ctx context.Context, orgID, actorUserID, targetUserID string) error
	LeaveOrg(ctx context.Context, orgID, userID string) error

	ResolveUserRole(ctx context.Context, orgID, userID string) (domain.OrgRole, error)
}

type orgService struct {
	orgRepo     repository.OrgRepository
	memberRepo  repository.MemberRepository
	userRepo    repository.UserRepository
	tenantCache cache.TenantCache
}

func NewOrgService(
	orgRepo repository.OrgRepository,
	memberRepo repository.MemberRepository,
	userRepo repository.UserRepository,
	tenantCache cache.TenantCache,
) OrgService {
	return &orgService{
		orgRepo:     orgRepo,
		memberRepo:  memberRepo,
		userRepo:    userRepo,
		tenantCache: tenantCache,
	}
}

// CreateOrg validates slug syntax, checks reserved list, and creates the org with owner membership under an advisory lock.
func (s *orgService) CreateOrg(ctx context.Context, userID string, req domain.CreateOrgRequest) (*domain.OrgResponse, error) {
	name := strings.TrimSpace(req.Name)
	if len(name) < 2 || len(name) > 100 {
		return nil, domain.NewValidationError("Organization name must be between 2 and 100 characters", nil)
	}

	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	if len(slug) < 2 || len(slug) > 50 || !slugRegex.MatchString(slug) {
		return nil, domain.NewValidationError("Slug must be 2-50 characters, lowercase alphanumeric and hyphens, and cannot start or end with a hyphen", nil)
	}

	if _, isReserved := reservedSlugs[slug]; isReserved {
		return nil, domain.NewReservedSlugError()
	}

	org := &domain.Organization{
		Name:        name,
		Slug:        slug,
		Description: strings.TrimSpace(req.Description),
	}

	if err := s.orgRepo.CreateWithLimitCheck(ctx, org, userID); err != nil {
		var appErr *domain.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, domain.NewInternalError(err)
	}

	// Cache owner role in tenant cache
	if s.tenantCache != nil {
		s.tenantCache.SetRole(org.ID, userID, domain.RoleOwner, 60*time.Second)
	}

	return domain.ToOrgResponse(org), nil
}

// ListUserOrgs returns all organizations the caller belongs to.
func (s *orgService) ListUserOrgs(ctx context.Context, userID string) ([]*domain.OrgResponse, error) {
	orgs, err := s.orgRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	responses := make([]*domain.OrgResponse, len(orgs))
	for i, o := range orgs {
		responses[i] = domain.ToOrgResponse(o)
	}
	return responses, nil
}

// GetOrg retrieves an organization ensuring zero-enumeration: non-members receive 404 NOT_FOUND.
func (s *orgService) GetOrg(ctx context.Context, orgID, userID string) (*domain.OrgResponse, error) {
	role, err := s.ResolveUserRole(ctx, orgID, userID)
	if err != nil {
		return nil, err
	}

	org, err := s.orgRepo.FindByID(ctx, orgID)
	if err != nil {
		if errors.Is(err, repository.ErrOrgNotFound) {
			return nil, domain.NewNotFoundError("Organization not found")
		}
		return nil, domain.NewInternalError(err)
	}

	org.Role = role
	return domain.ToOrgResponse(org), nil
}

// UpdateOrg updates organization details (slug is immutable in v1).
func (s *orgService) UpdateOrg(ctx context.Context, orgID, userID string, req domain.UpdateOrgRequest) (*domain.OrgResponse, error) {
	name := strings.TrimSpace(req.Name)
	if len(name) < 2 || len(name) > 100 {
		return nil, domain.NewValidationError("Organization name must be between 2 and 100 characters", nil)
	}

	org, err := s.orgRepo.FindByID(ctx, orgID)
	if err != nil {
		if errors.Is(err, repository.ErrOrgNotFound) {
			return nil, domain.NewNotFoundError("Organization not found")
		}
		return nil, domain.NewInternalError(err)
	}

	org.Name = name
	org.Description = strings.TrimSpace(req.Description)

	if err := s.orgRepo.Update(ctx, org); err != nil {
		return nil, domain.NewInternalError(err)
	}

	// Re-resolve caller's role for response
	role, _ := s.ResolveUserRole(ctx, orgID, userID)
	org.Role = role

	return domain.ToOrgResponse(org), nil
}

// DeleteOrg requires confirm_slug match and soft-deletes the organization.
func (s *orgService) DeleteOrg(ctx context.Context, orgID, userID string, req domain.DeleteOrgRequest) error {
	org, err := s.orgRepo.FindByID(ctx, orgID)
	if err != nil {
		if errors.Is(err, repository.ErrOrgNotFound) {
			return domain.NewNotFoundError("Organization not found")
		}
		return domain.NewInternalError(err)
	}

	if !strings.EqualFold(strings.TrimSpace(req.ConfirmSlug), org.Slug) {
		return domain.NewConfirmationMismatchError()
	}

	if err := s.orgRepo.SoftDelete(ctx, orgID); err != nil {
		return domain.NewInternalError(err)
	}

	if s.tenantCache != nil {
		s.tenantCache.Invalidate(orgID, userID)
	}

	return nil
}

// AddMember adds a user by email with limit verification under advisory lock.
func (s *orgService) AddMember(ctx context.Context, orgID, actorUserID string, req domain.AddMemberRequest) (*domain.OrgMemberDetailResponse, error) {
	if req.Role == domain.RoleOwner {
		return nil, domain.NewForbiddenError(domain.ErrCodeForbiddenRole, "The owner role cannot be assigned through this route")
	}

	if !req.Role.IsValid() {
		return nil, domain.NewValidationError("Invalid organization role", nil)
	}

	targetUser, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, domain.NewAppError(fiber.StatusNotFound, domain.ErrCodeUserNotFound, "User with this email not found", nil)
		}
		return nil, domain.NewInternalError(err)
	}

	member := &domain.OrgMember{
		OrgID:    orgID,
		UserID:   targetUser.ID,
		Role:     req.Role,
		JoinedAt: time.Now().UTC(),
	}

	if err := s.memberRepo.AddMemberWithLimitCheck(ctx, member); err != nil {
		var appErr *domain.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, domain.NewInternalError(err)
	}

	if s.tenantCache != nil {
		s.tenantCache.SetRole(orgID, targetUser.ID, req.Role, 60*time.Second)
	}

	return &domain.OrgMemberDetailResponse{
		UserID:    targetUser.ID,
		Email:     targetUser.Email,
		FirstName: targetUser.FirstName,
		LastName:  targetUser.LastName,
		Username:  targetUser.Username,
		Role:      req.Role,
		JoinedAt:  member.JoinedAt,
	}, nil
}

// ListMembers lists members matching query filters.
func (s *orgService) ListMembers(ctx context.Context, orgID string, query domain.ListMembersQuery) ([]*domain.OrgMemberDetailResponse, error) {
	return s.memberRepo.ListMembers(ctx, orgID, query)
}

// UpdateMemberRole updates a member's role while preserving owner immunity, preventing self-demotion, and enforcing last owner safety.
func (s *orgService) UpdateMemberRole(ctx context.Context, orgID, actorUserID, targetUserID string, req domain.UpdateMemberRoleRequest) (*domain.OrgMemberDetailResponse, error) {
	if actorUserID == targetUserID {
		return nil, domain.NewCannotModifyOwnRoleError()
	}

	if req.Role == domain.RoleOwner {
		return nil, domain.NewForbiddenError(domain.ErrCodeForbiddenRole, "The owner role cannot be assigned through this route")
	}

	if !req.Role.IsValid() {
		return nil, domain.NewValidationError("Invalid organization role", nil)
	}

	targetMember, err := s.memberRepo.FindMember(ctx, orgID, targetUserID)
	if err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return nil, domain.NewNotFoundError("Member not found in organization")
		}
		return nil, domain.NewInternalError(err)
	}

	// Owner immunity: admins cannot demote or modify an owner
	if targetMember.Role == domain.RoleOwner {
		return nil, domain.NewForbiddenError(domain.ErrCodeForbiddenRole, "Cannot modify an owner's role")
	}

	if err := s.memberRepo.UpdateRole(ctx, orgID, targetUserID, req.Role); err != nil {
		return nil, domain.NewInternalError(err)
	}

	// Invalidate tenant cache
	if s.tenantCache != nil {
		s.tenantCache.Invalidate(orgID, targetUserID)
	}

	targetUser, err := s.userRepo.FindByID(ctx, targetUserID)
	if err != nil {
		return nil, domain.NewInternalError(err)
	}

	return &domain.OrgMemberDetailResponse{
		UserID:    targetUser.ID,
		Email:     targetUser.Email,
		FirstName: targetUser.FirstName,
		LastName:  targetUser.LastName,
		Username:  targetUser.Username,
		Role:      req.Role,
		JoinedAt:  targetMember.JoinedAt,
	}, nil
}

// RemoveMember removes a member while preventing owner deletion and self-removal via DELETE.
func (s *orgService) RemoveMember(ctx context.Context, orgID, actorUserID, targetUserID string) error {
	if actorUserID == targetUserID {
		return domain.NewBadRequestError("To remove yourself, use the leave endpoint", nil)
	}

	targetMember, err := s.memberRepo.FindMember(ctx, orgID, targetUserID)
	if err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return domain.NewNotFoundError("Member not found in organization")
		}
		return domain.NewInternalError(err)
	}

	// Owner immunity: owners cannot be removed via admin endpoint
	if targetMember.Role == domain.RoleOwner {
		return domain.NewForbiddenError(domain.ErrCodeForbiddenRole, "Cannot remove an owner from the organization")
	}

	if err := s.memberRepo.RemoveMember(ctx, orgID, targetUserID); err != nil {
		return domain.NewInternalError(err)
	}

	if s.tenantCache != nil {
		s.tenantCache.Invalidate(orgID, targetUserID)
	}

	return nil
}

// LeaveOrg allows a member to voluntarily leave, guaranteeing the organization retains at least one owner.
func (s *orgService) LeaveOrg(ctx context.Context, orgID, userID string) error {
	member, err := s.memberRepo.FindMember(ctx, orgID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return domain.NewNotFoundError("Member not found in organization")
		}
		return domain.NewInternalError(err)
	}

	if member.Role == domain.RoleOwner {
		ownersCount, err := s.memberRepo.CountOwners(ctx, orgID)
		if err != nil {
			return domain.NewInternalError(err)
		}
		if ownersCount <= 1 {
			return domain.NewLastOwnerError()
		}
	}

	if err := s.memberRepo.RemoveMember(ctx, orgID, userID); err != nil {
		return domain.NewInternalError(err)
	}

	if s.tenantCache != nil {
		s.tenantCache.Invalidate(orgID, userID)
	}

	return nil
}

// ResolveUserRole returns the user's role in an org using 60s tenant cache or DB.
// If caller has no membership, returns 404 NOT_FOUND to prevent tenant enumeration.
func (s *orgService) ResolveUserRole(ctx context.Context, orgID, userID string) (domain.OrgRole, error) {
	if s.tenantCache != nil {
		if role, found := s.tenantCache.GetRole(orgID, userID); found {
			return role, nil
		}
	}

	member, err := s.memberRepo.FindMember(ctx, orgID, userID)
	if err != nil {
		if errors.Is(err, repository.ErrMemberNotFound) {
			return "", domain.NewNotFoundError("Organization not found")
		}
		return "", domain.NewInternalError(err)
	}

	if s.tenantCache != nil {
		s.tenantCache.SetRole(orgID, userID, member.Role, 60*time.Second)
	}

	return member.Role, nil
}
