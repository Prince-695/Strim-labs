package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProject_RBAC_Matrix(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	// 1. Create Users for all hierarchy roles
	owner := &domain.User{ID: "usr-p-owner", Email: "p-owner@strim.dev", IsVerified: true}
	admin := &domain.User{ID: "usr-p-admin", Email: "p-admin@strim.dev", IsVerified: true}
	member := &domain.User{ID: "usr-p-member", Email: "p-member@strim.dev", IsVerified: true}
	viewer := &domain.User{ID: "usr-p-viewer", Email: "p-viewer@strim.dev", IsVerified: true}
	outsider := &domain.User{ID: "usr-p-outsider", Email: "p-outsider@strim.dev", IsVerified: true}

	for _, u := range []*domain.User{owner, admin, member, viewer, outsider} {
		require.NoError(t, rig.userRepo.Create(ctx, u))
	}

	// 2. Create Target Organization
	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Project Matrix Org",
		Slug: "proj-matrix-org",
	})
	require.NoError(t, err)

	_, err = rig.orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{Email: admin.Email, Role: domain.RoleAdmin})
	require.NoError(t, err)
	_, err = rig.orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{Email: member.Email, Role: domain.RoleMember})
	require.NoError(t, err)
	_, err = rig.orgSvc.AddMember(ctx, org.ID, owner.ID, domain.AddMemberRequest{Email: viewer.Email, Role: domain.RoleViewer})
	require.NoError(t, err)

	tokens := map[string]string{
		"owner":    rig.createAuthToken(t, owner.ID, owner.Email, true),
		"admin":    rig.createAuthToken(t, admin.ID, admin.Email, true),
		"member":   rig.createAuthToken(t, member.ID, member.Email, true),
		"viewer":   rig.createAuthToken(t, viewer.ID, viewer.Email, true),
		"outsider": rig.createAuthToken(t, outsider.ID, outsider.Email, true),
	}

	// 3. Seed an initial project for GET/PUT/DELETE tests
	seedProj, err := rig.projectSvc.CreateProject(ctx, org.ID, domain.CreateProjectRequest{
		Name:        "Seed Project",
		Slug:        "seed-project",
		BaseURL:     "https://api.acme.com",
		Environment: domain.EnvProduction,
	})
	require.NoError(t, err)

	type endpointTest struct {
		name          string
		method        string
		path          string
		bodyFunc      func(role string) []byte
		expectedCodes map[string]int
	}

	matrix := []endpointTest{
		{
			name:   "List Projects (Min: viewer)",
			method: "GET",
			path:   fmt.Sprintf("/v1/organizations/%s/projects", org.ID),
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusOK,
				"viewer":   fiber.StatusOK,
				"outsider": fiber.StatusNotFound, // Zero enumeration
			},
		},
		{
			name:   "Get Project Details (Min: viewer)",
			method: "GET",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s", org.ID, seedProj.ID),
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusOK,
				"viewer":   fiber.StatusOK,
				"outsider": fiber.StatusNotFound,
			},
		},
		{
			name:   "Create Project (Min: admin)",
			method: "POST",
			path:   fmt.Sprintf("/v1/organizations/%s/projects", org.ID),
			bodyFunc: func(role string) []byte {
				b, _ := json.Marshal(domain.CreateProjectRequest{
					Name:        fmt.Sprintf("Proj by %s", role),
					Slug:        fmt.Sprintf("proj-%s", role),
					BaseURL:     "https://api.acme.com",
					Environment: domain.EnvProduction,
				})
				return b
			},
			expectedCodes: map[string]int{
				"owner":    fiber.StatusCreated,
				"admin":    fiber.StatusCreated,
				"member":   fiber.StatusForbidden,
				"viewer":   fiber.StatusForbidden,
				"outsider": fiber.StatusNotFound,
			},
		},
		{
			name:   "Update Project (Min: admin)",
			method: "PUT",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s", org.ID, seedProj.ID),
			bodyFunc: func(role string) []byte {
				desc := fmt.Sprintf("Updated by %s", role)
				b, _ := json.Marshal(domain.UpdateProjectRequest{
					Description: &desc,
				})
				return b
			},
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusForbidden,
				"viewer":   fiber.StatusForbidden,
				"outsider": fiber.StatusNotFound,
			},
		},
		{
			name:   "Initiate Verification (Min: admin)",
			method: "POST",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s/verification", org.ID, seedProj.ID),
			bodyFunc: func(role string) []byte {
				b, _ := json.Marshal(domain.InitiateVerificationRequest{
					Method: domain.MethodDNS,
				})
				return b
			},
			expectedCodes: map[string]int{
				"owner":    fiber.StatusCreated,
				"admin":    fiber.StatusCreated,
				"member":   fiber.StatusForbidden,
				"viewer":   fiber.StatusForbidden,
				"outsider": fiber.StatusNotFound,
			},
		},
		{
			name:   "Get Verification Status (Min: viewer)",
			method: "GET",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s/verification", org.ID, seedProj.ID),
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusOK,
				"viewer":   fiber.StatusOK,
				"outsider": fiber.StatusNotFound,
			},
		},
		{
			name:   "Delete Project (Min: admin)",
			method: "DELETE",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s", org.ID, seedProj.ID),
			expectedCodes: map[string]int{
				"viewer":   fiber.StatusForbidden,
				"member":   fiber.StatusForbidden,
				"outsider": fiber.StatusNotFound,
				"admin":    fiber.StatusOK, // Executed last so seedProj exists for earlier tests
			},
		},
	}

	for _, ep := range matrix {
		t.Run(ep.name, func(t *testing.T) {
			for role, expectedStatus := range ep.expectedCodes {
				t.Run(role, func(t *testing.T) {
					var reqBody []byte
					if ep.bodyFunc != nil {
						reqBody = ep.bodyFunc(role)
					}

					req := httptest.NewRequest(ep.method, ep.path, bytes.NewReader(reqBody))
					req.Header.Set("Authorization", "Bearer "+tokens[role])
					if len(reqBody) > 0 {
						req.Header.Set("Content-Type", "application/json")
					}

					resp, err := rig.app.Test(req)
					require.NoError(t, err)
					assert.Equal(t, expectedStatus, resp.StatusCode, "Role %s received unexpected status on %s %s", role, ep.method, ep.path)
				})
			}
		})
	}
}

func TestProject_Limit5_RaceCondition(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	owner := &domain.User{ID: "usr-race-owner", Email: "race-owner@strim.dev", IsVerified: true}
	require.NoError(t, rig.userRepo.Create(ctx, owner))
	token := rig.createAuthToken(t, owner.ID, owner.Email, true)

	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Race Org",
		Slug: "race-org",
	})
	require.NoError(t, err)

	var successCount int64
	var conflictCount int64
	var wg sync.WaitGroup

	// Fire 10 concurrent creation requests
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			body, _ := json.Marshal(domain.CreateProjectRequest{
				Name:        fmt.Sprintf("Concurrent Project %d", idx),
				Slug:        fmt.Sprintf("concurrent-proj-%d", idx),
				BaseURL:     "https://api.acme.com",
				Environment: domain.EnvProduction,
			})

			req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects", org.ID), bytes.NewReader(body))
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/json")

			resp, err := rig.app.Test(req)
			if err != nil {
				return
			}

			if resp.StatusCode == fiber.StatusCreated {
				atomic.AddInt64(&successCount, 1)
			} else if resp.StatusCode == fiber.StatusConflict {
				atomic.AddInt64(&conflictCount, 1)
			}
		}(i)
	}

	wg.Wait()

	assert.Equal(t, int64(5), atomic.LoadInt64(&successCount), "Exactly 5 projects should have been created")
	assert.Equal(t, int64(5), atomic.LoadInt64(&conflictCount), "Remaining 5 projects should have received 409 PROJECT_LIMIT_REACHED")
}

func TestProject_SSRF_Rejection(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	owner := &domain.User{ID: "usr-ssrf-owner", Email: "ssrf-owner@strim.dev", IsVerified: true}
	require.NoError(t, rig.userRepo.Create(ctx, owner))
	token := rig.createAuthToken(t, owner.ID, owner.Email, true)

	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "SSRF Org",
		Slug: "ssrf-org",
	})
	require.NoError(t, err)

	blockedTargets := []string{
		"http://127.0.0.1:8080/v1",
		"http://localhost:8080",
		"http://169.254.169.254/latest/meta-data",
		"https://internal.acme.com/admin",
	}

	for _, target := range blockedTargets {
		t.Run(target, func(t *testing.T) {
			body, _ := json.Marshal(domain.CreateProjectRequest{
				Name:    "Blocked Target",
				Slug:    "blocked-slug",
				BaseURL: target,
			})

			req := httptest.NewRequest("POST", fmt.Sprintf("/v1/organizations/%s/projects", org.ID), bytes.NewReader(body))
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/json")

			resp, err := rig.app.Test(req)
			require.NoError(t, err)
			assert.Equal(t, fiber.StatusUnprocessableEntity, resp.StatusCode)

			var res domain.Response
			err = json.NewDecoder(resp.Body).Decode(&res)
			require.NoError(t, err)
			assert.False(t, res.Success)
			assert.Equal(t, domain.ErrCodeTargetBlocked, res.ErrorCode)
		})
	}
}
