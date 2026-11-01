package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRBAC_Matrix_And_CrossTenantConcealment(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	// 1. Create Organization Owner
	owner := &domain.User{ID: "usr-owner", Email: "owner@strim.dev", IsVerified: true}
	admin := &domain.User{ID: "usr-admin", Email: "admin@strim.dev", IsVerified: true}
	member := &domain.User{ID: "usr-member", Email: "member@strim.dev", IsVerified: true}
	viewer := &domain.User{ID: "usr-viewer", Email: "viewer@strim.dev", IsVerified: true}
	nonMember := &domain.User{ID: "usr-outsider", Email: "outsider@strim.dev", IsVerified: true}

	for _, u := range []*domain.User{owner, admin, member, viewer, nonMember} {
		require.NoError(t, rig.userRepo.Create(ctx, u))
	}

	// 2. Create Target Organization
	targetOrg, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Matrix Org",
		Slug: "matrix-org",
	})
	require.NoError(t, err)

	// Add roles
	_, err = rig.orgSvc.AddMember(ctx, targetOrg.ID, owner.ID, domain.AddMemberRequest{Email: admin.Email, Role: domain.RoleAdmin})
	require.NoError(t, err)
	_, err = rig.orgSvc.AddMember(ctx, targetOrg.ID, owner.ID, domain.AddMemberRequest{Email: member.Email, Role: domain.RoleMember})
	require.NoError(t, err)
	_, err = rig.orgSvc.AddMember(ctx, targetOrg.ID, owner.ID, domain.AddMemberRequest{Email: viewer.Email, Role: domain.RoleViewer})
	require.NoError(t, err)

	// User tokens
	tokens := map[string]string{
		"owner":      rig.createAuthToken(t, owner.ID, owner.Email, true),
		"admin":      rig.createAuthToken(t, admin.ID, admin.Email, true),
		"member":     rig.createAuthToken(t, member.ID, member.Email, true),
		"viewer":     rig.createAuthToken(t, viewer.ID, viewer.Email, true),
		"non-member": rig.createAuthToken(t, nonMember.ID, nonMember.Email, true),
	}

	// Helper for target user to manipulate in member tests
	seedTargetUser := func(id, email string) {
		u := &domain.User{ID: id, Email: email, IsVerified: true}
		_ = rig.userRepo.Create(ctx, u)
	}

	// Table Test: Every Endpoint x Every Role
	type endpointTest struct {
		name          string
		method        string
		pathTemplate  string
		bodyFunc      func(role string) []byte
		expectedCodes map[string]int
	}

	matrix := []endpointTest{
		{
			name:         "Get Org Details (Min: viewer)",
			method:       "GET",
			pathTemplate: "/v1/organizations/%s",
			bodyFunc:     func(role string) []byte { return nil },
			expectedCodes: map[string]int{
				"owner":      fiber.StatusOK,
				"admin":      fiber.StatusOK,
				"member":     fiber.StatusOK,
				"viewer":     fiber.StatusOK,
				"non-member": fiber.StatusNotFound, // Zero-enumeration!
			},
		},
		{
			name:         "Update Org Details (Min: admin)",
			method:       "PUT",
			pathTemplate: "/v1/organizations/%s",
			bodyFunc: func(role string) []byte {
				b, _ := json.Marshal(domain.UpdateOrgRequest{Name: "Matrix Renamed", Description: "New desc"})
				return b
			},
			expectedCodes: map[string]int{
				"owner":      fiber.StatusOK,
				"admin":      fiber.StatusOK,
				"member":     fiber.StatusForbidden,
				"viewer":     fiber.StatusForbidden,
				"non-member": fiber.StatusNotFound,
			},
		},
		{
			name:         "List Members (Min: viewer)",
			method:       "GET",
			pathTemplate: "/v1/organizations/%s/members",
			bodyFunc:     func(role string) []byte { return nil },
			expectedCodes: map[string]int{
				"owner":      fiber.StatusOK,
				"admin":      fiber.StatusOK,
				"member":     fiber.StatusOK,
				"viewer":     fiber.StatusOK,
				"non-member": fiber.StatusNotFound,
			},
		},
		{
			name:         "Add Member (Min: admin)",
			method:       "POST",
			pathTemplate: "/v1/organizations/%s/members",
			bodyFunc: func(role string) []byte {
				email := fmt.Sprintf("new-%s-%d@strim.dev", role, time.Now().UnixNano())
				seedTargetUser("new-"+role, email)
				b, _ := json.Marshal(domain.AddMemberRequest{Email: email, Role: domain.RoleViewer})
				return b
			},
			expectedCodes: map[string]int{
				"owner":      fiber.StatusCreated,
				"admin":      fiber.StatusCreated,
				"member":     fiber.StatusForbidden,
				"viewer":     fiber.StatusForbidden,
				"non-member": fiber.StatusNotFound,
			},
		},
	}

	for _, ep := range matrix {
		t.Run(ep.name, func(t *testing.T) {
			for role, expectedStatus := range ep.expectedCodes {
				t.Run(role, func(t *testing.T) {
					path := fmt.Sprintf(ep.pathTemplate, targetOrg.ID)
					var reqBody []byte
					if ep.bodyFunc != nil {
						reqBody = ep.bodyFunc(role)
					}

					req := httptest.NewRequest(ep.method, path, bytes.NewReader(reqBody))
					req.Header.Set("Authorization", "Bearer "+tokens[role])
					if len(reqBody) > 0 {
						req.Header.Set("Content-Type", "application/json")
					}

					resp, err := rig.app.Test(req)
					require.NoError(t, err)
					assert.Equal(t, expectedStatus, resp.StatusCode, "Role %s received unexpected status on %s %s", role, ep.method, path)
				})
			}
		})
	}
}

func TestOrg_Limit3_And_Delete(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	user := &domain.User{ID: "usr-creator", Email: "creator@acme.com", IsVerified: true}
	require.NoError(t, rig.userRepo.Create(ctx, user))
	token := rig.createAuthToken(t, user.ID, user.Email, true)

	// Create 3 organizations
	for i := 1; i <= 3; i++ {
		body, _ := json.Marshal(domain.CreateOrgRequest{
			Name: fmt.Sprintf("Org %d", i),
			Slug: fmt.Sprintf("org-slug-%d", i),
		})
		req := httptest.NewRequest("POST", "/v1/organizations", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := rig.app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	}

	// 4th creation attempt rejected
	body4, _ := json.Marshal(domain.CreateOrgRequest{
		Name: "Org 4",
		Slug: "org-slug-4",
	})
	req4 := httptest.NewRequest("POST", "/v1/organizations", bytes.NewReader(body4))
	req4.Header.Set("Authorization", "Bearer "+token)
	req4.Header.Set("Content-Type", "application/json")

	resp4, err := rig.app.Test(req4)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusConflict, resp4.StatusCode)

	// List caller organizations (returns 3)
	reqList := httptest.NewRequest("GET", "/v1/organizations", nil)
	reqList.Header.Set("Authorization", "Bearer "+token)
	respList, err := rig.app.Test(reqList)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respList.StatusCode)
}
