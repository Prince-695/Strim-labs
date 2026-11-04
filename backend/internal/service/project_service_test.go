package service_test

import (
	"context"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type staticResolver struct {
	ips map[string][]net.IP
}

func (r *staticResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	if ips, ok := r.ips[host]; ok {
		return ips, nil
	}
	return nil, &net.DNSError{Err: "no such host", Name: host}
}

func setupProjectServiceTest(t *testing.T) (service.ProjectService, repository.ProjectRepository, repository.VerificationRepository, cache.ProjectCache, *mockDNSTXTResolver) {
	memCache := cache.NewMemoryCache()
	projCache := cache.NewProjectCache(memCache)

	resolver := &staticResolver{
		ips: map[string][]net.IP{
			"api.acme.com":      {net.ParseIP("93.184.216.34")},
			"api-v2.acme.com":   {net.ParseIP("93.184.216.35")},
			"internal.acme.com": {net.ParseIP("10.0.0.1")},
		},
	}
	guard := netguard.NewSSRFGuard(resolver)

	dnsResolver := &mockDNSTXTResolver{
		records: make(map[string][]string),
	}
	verifEngine := service.NewVerificationEngine(dnsResolver, nil)

	projRepo := repository.NewInMemoryProjectRepository()
	verifRepo := repository.NewInMemoryVerificationRepository(projRepo)

	svc := service.NewProjectService(projRepo, verifRepo, projCache, guard, verifEngine)
	return svc, projRepo, verifRepo, projCache, dnsResolver
}

func TestProjectService_CreateProject_Success(t *testing.T) {
	svc, _, _, _, _ := setupProjectServiceTest(t)
	ctx := context.Background()

	resp, err := svc.CreateProject(ctx, "org-1", domain.CreateProjectRequest{
		Name:        "Orders API",
		Slug:        "orders-api",
		Description: "Order management",
		BaseURL:     "https://api.acme.com",
		Environment: domain.EnvProduction,
	})

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "Orders API", resp.Name)
	assert.Equal(t, "orders-api", resp.Slug)
	assert.Equal(t, "https://api.acme.com", resp.BaseURL)
	assert.Equal(t, domain.StatusUnverified, resp.VerificationStatus)
	assert.Equal(t, domain.HealthNoData, resp.Health)
}

func TestProjectService_CreateProject_Max5Limit(t *testing.T) {
	svc, _, _, _, _ := setupProjectServiceTest(t)
	ctx := context.Background()

	// Create 5 projects successfully
	for i := 1; i <= 5; i++ {
		_, err := svc.CreateProject(ctx, "org-limit", domain.CreateProjectRequest{
			Name:        fmt.Sprintf("Service %d", i),
			Slug:        fmt.Sprintf("service-%d", i),
			BaseURL:     "https://api.acme.com",
			Environment: domain.EnvProduction,
		})
		require.NoError(t, err)
	}

	// 6th project creation must be rejected with 409 PROJECT_LIMIT_REACHED
	_, err := svc.CreateProject(ctx, "org-limit", domain.CreateProjectRequest{
		Name:        "Service 6",
		Slug:        "service-6",
		BaseURL:     "https://api.acme.com",
		Environment: domain.EnvProduction,
	})
	require.Error(t, err)

	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeProjectLimitReached, appErr.ErrorCode)
	assert.Equal(t, 409, appErr.HTTPStatus)
}

func TestProjectService_CreateProject_SSRF_Blocked(t *testing.T) {
	svc, _, _, _, _ := setupProjectServiceTest(t)
	ctx := context.Background()

	t.Run("Loopback target", func(t *testing.T) {
		_, err := svc.CreateProject(ctx, "org-1", domain.CreateProjectRequest{
			Name:    "Local Test",
			Slug:    "local-test",
			BaseURL: "http://127.0.0.1:8080",
		})
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
		assert.Equal(t, 422, appErr.HTTPStatus)
	})

	t.Run("Internal network target", func(t *testing.T) {
		_, err := svc.CreateProject(ctx, "org-1", domain.CreateProjectRequest{
			Name:    "Internal Service",
			Slug:    "internal-service",
			BaseURL: "https://internal.acme.com",
		})
		require.Error(t, err)
		var appErr *domain.AppError
		require.ErrorAs(t, err, &appErr)
		assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
	})
}

func TestProjectService_UpdateProject_HostChangeResetsVerification(t *testing.T) {
	svc, projRepo, _, _, _ := setupProjectServiceTest(t)
	ctx := context.Background()

	created, err := svc.CreateProject(ctx, "org-1", domain.CreateProjectRequest{
		Name:    "Original API",
		Slug:    "original-api",
		BaseURL: "https://api.acme.com",
	})
	require.NoError(t, err)

	// Simulate verified project
	now := time.Now().UTC()
	p, err := projRepo.FindByID(ctx, "org-1", created.ID)
	require.NoError(t, err)
	p.VerificationStatus = domain.StatusVerified
	p.VerifiedAt = &now
	require.NoError(t, projRepo.Update(ctx, p))

	// Update base URL to different host
	newURL := "https://api-v2.acme.com"
	updated, err := svc.UpdateProject(ctx, "org-1", created.ID, domain.UpdateProjectRequest{
		BaseURL: &newURL,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.StatusUnverified, updated.VerificationStatus)
	assert.Nil(t, updated.VerifiedAt)
}

func TestProjectService_VerificationLifecycle(t *testing.T) {
	svc, _, _, _, dnsResolver := setupProjectServiceTest(t)
	ctx := context.Background()

	created, err := svc.CreateProject(ctx, "org-1", domain.CreateProjectRequest{
		Name:    "Verification Target",
		Slug:    "verif-target",
		BaseURL: "https://api.acme.com",
	})
	require.NoError(t, err)

	// 1. Initiate verification
	initResp, err := svc.InitiateVerification(ctx, "org-1", created.ID, domain.InitiateVerificationRequest{
		Method: domain.MethodDNS,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.StatusPending, initResp.Status)
	assert.NotEmpty(t, initResp.Token)

	// 2. Check verification before DNS TXT is published -> fails
	check1, err := svc.CheckVerification(ctx, "org-1", created.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.StatusFailed, check1.Status)
	assert.NotEmpty(t, check1.Reason)

	// 3. Publish DNS TXT record
	dnsResolver.records["_strim.api.acme.com"] = []string{initResp.Token}

	// 4. Check verification again -> succeeds
	check2, err := svc.CheckVerification(ctx, "org-1", created.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.StatusVerified, check2.Status)
	assert.NotNil(t, check2.VerifiedAt)

	// 5. Verify project detail reflects verified status
	proj, err := svc.GetProject(ctx, "org-1", created.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.StatusVerified, proj.VerificationStatus)
}
