package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http/httptest"
	"testing"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegistry_RBAC_Matrix(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	// 1. Create hierarchy users
	owner := &domain.User{ID: "usr-reg-owner", Email: "reg-owner@strim.dev", IsVerified: true}
	admin := &domain.User{ID: "usr-reg-admin", Email: "reg-admin@strim.dev", IsVerified: true}
	member := &domain.User{ID: "usr-reg-member", Email: "reg-member@strim.dev", IsVerified: true}
	viewer := &domain.User{ID: "usr-reg-viewer", Email: "reg-viewer@strim.dev", IsVerified: true}
	outsider := &domain.User{ID: "usr-reg-outsider", Email: "reg-outsider@strim.dev", IsVerified: true}

	for _, u := range []*domain.User{owner, admin, member, viewer, outsider} {
		require.NoError(t, rig.userRepo.Create(ctx, u))
	}

	// 2. Create Organization & assign memberships
	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Registry Matrix Org",
		Slug: "registry-matrix-org",
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

	// 3. Create Project
	proj, err := rig.projectSvc.CreateProject(ctx, org.ID, domain.CreateProjectRequest{
		Name:    "Registry Test Project",
		Slug:    "registry-test-project",
		BaseURL: "https://api.acme.com",
	})
	require.NoError(t, err)

	// 4. Seed an endpoint
	seedRoute := discovery.DiscoveredRoute{Method: "GET", PathTemplate: "/orders", Service: "orders", Tags: []string{"checkout"}}
	seedEP, _, err := rig.endpointRepo.UpsertRoute(ctx, proj.ID, seedRoute, domain.SourceOpenAPI, nil)
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
			name:   "List Endpoints (Min: viewer)",
			method: "GET",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s/endpoints", org.ID, proj.ID),
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusOK,
				"viewer":   fiber.StatusOK,
				"outsider": fiber.StatusNotFound, // Zero enumeration
			},
		},
		{
			name:   "Get Endpoint Detail (Min: viewer)",
			method: "GET",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s/endpoints/%s", org.ID, proj.ID, seedEP.ID),
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusOK,
				"viewer":   fiber.StatusOK,
				"outsider": fiber.StatusNotFound,
			},
		},
		{
			name:   "Patch Endpoint (Min: member)",
			method: "PATCH",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s/endpoints/%s", org.ID, proj.ID, seedEP.ID),
			bodyFunc: func(role string) []byte {
				status := domain.EndpointStatusIgnored
				b, _ := json.Marshal(domain.PatchEndpointRequest{
					Status: &status,
				})
				return b
			},
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusOK,
				"viewer":   fiber.StatusForbidden,
				"outsider": fiber.StatusNotFound,
			},
		},
		{
			name:   "Import Manifest (Min: admin)",
			method: "POST",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s/discovery/manifest", org.ID, proj.ID),
			bodyFunc: func(role string) []byte {
				m := domain.DiscoveryManifest{
					Version: 1,
					Source:  domain.SourceManifest,
					Service: "inventory",
					Routes: []domain.DiscoveryManifestRoute{
						{Method: "GET", Path: "/items"},
					},
				}
				b, _ := json.Marshal(m)
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
			name:   "List Discovery Runs (Min: viewer)",
			method: "GET",
			path:   fmt.Sprintf("/v1/organizations/%s/projects/%s/discovery/runs", org.ID, proj.ID),
			expectedCodes: map[string]int{
				"owner":    fiber.StatusOK,
				"admin":    fiber.StatusOK,
				"member":   fiber.StatusOK,
				"viewer":   fiber.StatusOK,
				"outsider": fiber.StatusNotFound,
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

func TestDiscovery_OpenAPI_MultipartUpload(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	owner := &domain.User{ID: "usr-upload-owner", Email: "upload-owner@strim.dev", IsVerified: true}
	require.NoError(t, rig.userRepo.Create(ctx, owner))
	token := rig.createAuthToken(t, owner.ID, owner.Email, true)

	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "Upload Org",
		Slug: "upload-org",
	})
	require.NoError(t, err)

	proj, err := rig.projectSvc.CreateProject(ctx, org.ID, domain.CreateProjectRequest{
		Name:    "Upload Project",
		Slug:    "upload-project",
		BaseURL: "https://api.acme.com",
	})
	require.NoError(t, err)

	// Create multipart body
	specContent := `{
	  "openapi": "3.0.0",
	  "info": { "title": "Inventory Service", "version": "1.0.0" },
	  "paths": {
	    "/inventory": {
	      "get": { "responses": { "200": { "description": "OK" } } }
	    }
	  }
	}`

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "openapi.json")
	require.NoError(t, err)
	_, err = part.Write([]byte(specContent))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(
		"POST",
		fmt.Sprintf("/v1/organizations/%s/projects/%s/discovery/openapi", org.ID, proj.ID),
		body,
	)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var res domain.Response
	err = json.NewDecoder(resp.Body).Decode(&res)
	require.NoError(t, err)
	assert.True(t, res.Success)
}

func TestDiscovery_CI_Ingest(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	owner := &domain.User{ID: "usr-ci-owner", Email: "ci-owner@strim.dev", IsVerified: true}
	require.NoError(t, rig.userRepo.Create(ctx, owner))

	org, err := rig.orgSvc.CreateOrg(ctx, owner.ID, domain.CreateOrgRequest{
		Name: "CI Org",
		Slug: "ci-org",
	})
	require.NoError(t, err)

	proj, err := rig.projectSvc.CreateProject(ctx, org.ID, domain.CreateProjectRequest{
		Name:    "CI Project",
		Slug:    "ci-project",
		BaseURL: "https://api.acme.com",
	})
	require.NoError(t, err)

	manifest := domain.DiscoveryManifest{
		Version: 1,
		Source:  domain.SourceCI,
		Service: "orders",
		Commit:  "1a2b3c4",
		Repo:    "acme/orders",
		Routes: []domain.DiscoveryManifestRoute{
			{Method: "GET", Path: "/orders/{id}"},
		},
	}
	body, _ := json.Marshal(manifest)

	req := httptest.NewRequest("POST", "/v1/ingest/discovery", bytes.NewReader(body))
	req.Header.Set("X-Project-ID", proj.ID)
	req.Header.Set("Content-Type", "application/json")

	resp, err := rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var res domain.Response
	err = json.NewDecoder(resp.Body).Decode(&res)
	require.NoError(t, err)
	assert.True(t, res.Success)
}
