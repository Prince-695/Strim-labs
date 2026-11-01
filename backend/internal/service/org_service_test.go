package service_test

import (
	"context"
	"testing"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupOrgServiceTest(t *testing.T) (service.OrgService, repository.UserRepository, repository.OrgRepository, repository.MemberRepository) {
	userRepo := repository.NewInMemoryUserRepository()
	memberRepo := repository.NewInMemoryMemberRepository(userRepo)
	orgRepo := repository.NewInMemoryOrgRepository(memberRepo)
	memCache := cache.NewMemoryCache()
	tenantCache := cache.NewTenantCache(memCache)

	orgSvc := service.NewOrgService(orgRepo, memberRepo, userRepo, tenantCache)
	return orgSvc, userRepo, orgRepo, memberRepo
}

func TestOrgService_CreateOrg_Limit3(t *testing.T) {
	ctx := context.Background()
	orgSvc, userRepo, _, _ := setupOrgServiceTest(t)

	user := &domain.User{
		ID:         "user-owner-1",
		Email:      "owner1@acme.com",
		FirstName:  "Owner",
		LastName:   "One",
		IsVerified: true,
	}
	require.NoError(t, userRepo.Create(ctx, user))

	// Create Org 1
	org1, err := orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Acme Corp 1",
		Slug: "acme-corp-1",
	})
	require.NoError(t, err)
	assert.Equal(t, domain.RoleOwner, org1.Role)

	// Create Org 2
	org2, err := orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Acme Corp 2",
		Slug: "acme-corp-2",
	})
	require.NoError(t, err)
	assert.Equal(t, domain.RoleOwner, org2.Role)

	// Create Org 3
	org3, err := orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Acme Corp 3",
		Slug: "acme-corp-3",
	})
	require.NoError(t, err)
	assert.Equal(t, domain.RoleOwner, org3.Role)

	// 4th Org must be rejected with ORG_LIMIT_REACHED
	_, err = orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Acme Corp 4",
		Slug: "acme-corp-4",
	})
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeOrgLimitReached, appErr.ErrorCode)
}

func TestOrgService_Reserved_And_DuplicateSlug(t *testing.T) {
	ctx := context.Background()
	orgSvc, userRepo, _, _ := setupOrgServiceTest(t)

	user := &domain.User{ID: "user-owner-2", Email: "owner2@acme.com", IsVerified: true}
	require.NoError(t, userRepo.Create(ctx, user))

	// Reserved slug
	_, err := orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Admin Org",
		Slug: "admin",
	})
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeReservedSlug, appErr.ErrorCode)

	// Create valid org
	_, err = orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Valid Org",
		Slug: "valid-org",
	})
	require.NoError(t, err)

	// Duplicate slug
	_, err = orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Duplicate Valid Org",
		Slug: "valid-org",
	})
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeSlugTaken, appErr.ErrorCode)
}

func TestOrgService_CrossTenantIsolation(t *testing.T) {
	ctx := context.Background()
	orgSvc, userRepo, _, _ := setupOrgServiceTest(t)

	userA := &domain.User{ID: "user-a", Email: "a@acme.com", IsVerified: true}
	userB := &domain.User{ID: "user-b", Email: "b@acme.com", IsVerified: true}
	require.NoError(t, userRepo.Create(ctx, userA))
	require.NoError(t, userRepo.Create(ctx, userB))

	orgA, err := orgSvc.CreateOrg(ctx, userA.ID, domain.CreateOrgRequest{
		Name: "Org Alpha",
		Slug: "org-alpha",
	})
	require.NoError(t, err)

	// User A can access Org A
	resp, err := orgSvc.GetOrg(ctx, orgA.ID, userA.ID)
	require.NoError(t, err)
	assert.Equal(t, "org-alpha", resp.Slug)

	// User B accessing Org A MUST return 404 NOT_FOUND (Zero enumeration)
	_, err = orgSvc.GetOrg(ctx, orgA.ID, userB.ID)
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeNotFound, appErr.ErrorCode)
}

func TestOrgService_DeleteOrg_ConfirmSlug(t *testing.T) {
	ctx := context.Background()
	orgSvc, userRepo, _, _ := setupOrgServiceTest(t)

	user := &domain.User{ID: "user-owner-3", Email: "owner3@acme.com", IsVerified: true}
	require.NoError(t, userRepo.Create(ctx, user))

	org, err := orgSvc.CreateOrg(ctx, user.ID, domain.CreateOrgRequest{
		Name: "Delete Me Org",
		Slug: "delete-me",
	})
	require.NoError(t, err)

	// Mismatched confirmation slug
	err = orgSvc.DeleteOrg(ctx, org.ID, user.ID, domain.DeleteOrgRequest{
		ConfirmSlug: "wrong-slug",
	})
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeConfirmationMismatch, appErr.ErrorCode)

	// Matched confirmation slug
	err = orgSvc.DeleteOrg(ctx, org.ID, user.ID, domain.DeleteOrgRequest{
		ConfirmSlug: "delete-me",
	})
	require.NoError(t, err)

	// Getting deleted org returns 404
	_, err = orgSvc.GetOrg(ctx, org.ID, user.ID)
	require.Error(t, err)
}

func TestOrgService_MemberManagement(t *testing.T) {
	ctx := context.Background()
	orgSvc, userRepo, _, _ := setupOrgServiceTest(t)

	owner := &domain.User{ID: "owner-id", Email: "owner@strim.dev", IsVerified: true}
	adminUser := &domain.User{ID: "admin-id", Email: "admin@strim.dev", IsVerified: true}
	memberUser := &domain.User{ID: "member-id", Email: "member@strim.dev", IsVerified: true}
	require.NoError(t, userRepo.Create(ctx, owner))
	require.NoError(t, userRepo.Create(ctx, adminUser))
	require.NoError(t, userRepo.Create(ctx, memberUser))

	org, err := orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Team Workspace",
		Slug: "team-workspace",
	})
	require.NoError(t, err)

	// 1. Add admin member
	m1, err := orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{
		Email: adminUser.Email,
		Role:  domain.RoleAdmin,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.RoleAdmin, m1.Role)

	// 2. Reject adding with owner role
	_, err = orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{
		Email: memberUser.Email,
		Role:  domain.RoleOwner,
	})
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeForbiddenRole, appErr.ErrorCode)

	// 3. Add regular member
	m2, err := orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{
		Email: memberUser.Email,
		Role:  domain.RoleMember,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.RoleMember, m2.Role)

	// 4. Duplicate add rejected
	_, err = orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{
		Email: memberUser.Email,
		Role:  domain.RoleMember,
	})
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeAlreadyMember, appErr.ErrorCode)

	// 5. Update role: Cannot change owner's role
	_, err = orgSvc.UpdateMemberRole(ctx, org.ID, adminUser.ID, owner.ID, domain.UpdateMemberRoleRequest{
		Role: domain.RoleViewer,
	})
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeForbiddenRole, appErr.ErrorCode)

	// 6. Update role: Cannot change own role
	_, err = orgSvc.UpdateMemberRole(ctx, org.ID, adminUser.ID, adminUser.ID, domain.UpdateMemberRoleRequest{
		Role: domain.RoleViewer,
	})
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeCannotModifyOwnRole, appErr.ErrorCode)

	// 7. Update role: Change member to viewer
	updated, err := orgSvc.UpdateMemberRole(ctx, org.ID, adminUser.ID, memberUser.ID, domain.UpdateMemberRoleRequest{
		Role: domain.RoleViewer,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.RoleViewer, updated.Role)

	// 8. Remove member: Cannot remove owner
	err = orgSvc.RemoveMember(ctx, org.ID, adminUser.ID, owner.ID)
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeForbiddenRole, appErr.ErrorCode)

	// 9. Remove member: Cannot remove self
	err = orgSvc.RemoveMember(ctx, org.ID, adminUser.ID, adminUser.ID)
	require.Error(t, err)

	// 10. Remove member: Successfully remove viewer
	err = orgSvc.RemoveMember(ctx, org.ID, adminUser.ID, memberUser.ID)
	require.NoError(t, err)

	// 11. Leave org: Sole owner cannot leave
	err = orgSvc.LeaveOrg(ctx, org.ID, owner.ID)
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeLastOwner, appErr.ErrorCode)

	// 12. Admin leaves successfully
	err = orgSvc.LeaveOrg(ctx, org.ID, adminUser.ID)
	require.NoError(t, err)
}
