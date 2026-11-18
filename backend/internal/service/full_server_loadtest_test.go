package service_test

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockFullServerResolver struct{}

func (m *mockFullServerResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	return []net.IP{net.ParseIP("93.184.216.34")}, nil
}

func TestLoadTestService_FullServer_AllEndpoints(t *testing.T) {
	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	projectRepo := repository.NewInMemoryProjectRepository()
	jobRepo := repository.NewInMemoryJobRepository()
	endpointRepo := repository.NewInMemoryEndpointRepository()
	clk := clock.NewRealClock()
	ssrfGuard := netguard.NewSSRFGuard(&mockFullServerResolver{})

	orgID := "org-fullserver-1"
	projectID := "proj-fullserver-1"
	ctx := context.Background()

	// Create verified project
	proj := &domain.Project{
		ID:                 projectID,
		OrgID:              orgID,
		Name:               "Production Backend",
		Slug:               "production-backend",
		BaseURL:            "https://api.acme.com",
		VerificationStatus: domain.StatusVerified,
		CreatedAt:          time.Now().UTC(),
		UpdatedAt:          time.Now().UTC(),
	}
	require.NoError(t, projectRepo.CreateWithLimitCheck(ctx, proj))

	// Register discovered endpoints
	_, _, err := endpointRepo.UpsertRoute(ctx, projectID, discovery.DiscoveredRoute{Method: "GET", PathTemplate: "/api/v1/feed"}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)
	_, _, err = endpointRepo.UpsertRoute(ctx, projectID, discovery.DiscoveredRoute{Method: "GET", PathTemplate: "/api/v1/products"}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)
	_, _, err = endpointRepo.UpsertRoute(ctx, projectID, discovery.DiscoveredRoute{Method: "POST", PathTemplate: "/api/v1/orders"}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	svc := service.NewLoadTestService(
		loadTestRepo,
		projectRepo,
		jobRepo,
		nil,
		ssrfGuard,
		"test-secret-key-32-bytes-long!",
		clk,
		endpointRepo,
	)

	// 1. Full Server test with AllEndpoints: true
	req := domain.CreateLoadTestRequest{
		Name:            "Full Server Stress Run",
		Model:           domain.ModelOpen,
		Profile:         domain.ProfileSustained,
		AllEndpoints:    true,
		StartNow:        true,
		StartRate:       100,
		PeakRate:        100,
		DurationSeconds: 60,
	}

	created, err := svc.CreateLoadTest(ctx, orgID, projectID, "user-1", req, "")
	require.NoError(t, err)
	require.NotNil(t, created)
	assert.Equal(t, domain.LoadTestStatusQueued, created.Status)
	assert.Len(t, created.Config.Targets, 3)

	// Check weights: GET should have higher weight than POST
	for _, tgt := range created.Config.Targets {
		if tgt.Method == "GET" {
			assert.Equal(t, 10, tgt.Weight)
		} else if tgt.Method == "POST" {
			assert.Equal(t, 2, tgt.Weight)
		}
	}

	// 2. Stop first test to release concurrent lock
	_, err = svc.StopLoadTest(ctx, orgID, projectID, created.ID)
	require.NoError(t, err)

	// 3. Full Server test with SafeOnly: true
	safeReq := domain.CreateLoadTestRequest{
		Name:            "Safe Only Stress Run",
		Model:           domain.ModelOpen,
		Profile:         domain.ProfileSustained,
		AllEndpoints:    true,
		SafeOnly:        true,
		StartNow:        true,
		StartRate:       50,
		PeakRate:        50,
		DurationSeconds: 30,
	}

	safeCreated, err := svc.CreateLoadTest(ctx, orgID, projectID, "user-1", safeReq, "")
	require.NoError(t, err)
	require.NotNil(t, safeCreated)
	assert.Len(t, safeCreated.Config.Targets, 2)
	for _, tgt := range safeCreated.Config.Targets {
		assert.Equal(t, "GET", tgt.Method)
	}
}
