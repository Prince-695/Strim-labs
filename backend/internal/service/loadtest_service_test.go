package service_test

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockIPResolver struct {
	ips map[string][]net.IP
}

func (m *mockIPResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	if ips, ok := m.ips[host]; ok {
		return ips, nil
	}
	return nil, &net.DNSError{Err: "no such host", Name: host}
}

type loadTestTestRig struct {
	svc          service.LoadTestService
	loadTestRepo repository.LoadTestRepository
	projectRepo  repository.ProjectRepository
	jobRepo      repository.JobRepository
	orgID        string
	projectID    string
}

func setupLoadTestRig(t *testing.T, verified bool, baseURL string) *loadTestTestRig {
	ctx := context.Background()
	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	projectRepo := repository.NewInMemoryProjectRepository()
	jobRepo := repository.NewInMemoryJobRepository()
	clk := clock.NewRealClock()

	mockRes := &mockIPResolver{
		ips: map[string][]net.IP{
			"api.acme.com":      {net.ParseIP("93.184.216.34")},
			"internal.acme.com": {net.ParseIP("10.0.0.1")},
			"loopback.acme.com": {net.ParseIP("127.0.0.1")},
		},
	}
	ssrfGuard := netguard.NewSSRFGuard(mockRes)

	orgID := "org-123"
	projectID := "proj-456"

	status := domain.StatusUnverified
	if verified {
		status = domain.StatusVerified
	}

	proj := &domain.Project{
		ID:                 projectID,
		OrgID:              orgID,
		Name:               "Test API",
		Slug:               "test-api",
		BaseURL:            baseURL,
		VerificationStatus: status,
		CreatedAt:          time.Now().UTC(),
		UpdatedAt:          time.Now().UTC(),
	}
	require.NoError(t, projectRepo.CreateWithLimitCheck(ctx, proj))

	svc := service.NewLoadTestService(
		loadTestRepo,
		projectRepo,
		jobRepo,
		nil,
		ssrfGuard,
		"my-crypto-secret-key-32-chars!!",
		clk,
	)

	return &loadTestTestRig{
		svc:          svc,
		loadTestRepo: loadTestRepo,
		projectRepo:  projectRepo,
		jobRepo:      jobRepo,
		orgID:        orgID,
		projectID:    projectID,
	}
}

func TestLoadTestService_TargetNotVerified(t *testing.T) {
	rig := setupLoadTestRig(t, false, "https://api.acme.com")
	ctx := context.Background()

	req := domain.CreateLoadTestRequest{
		Name:            "Checkout Test",
		Model:           domain.ModelOpen,
		Profile:         domain.ProfileSustained,
		Targets:         []domain.TargetItemRequest{{Method: "GET", Path: "/orders", Weight: 1}},
		StartRate:       10,
		DurationSeconds: 60,
		StartNow:        true,
	}

	_, err := rig.svc.CreateLoadTest(ctx, rig.orgID, rig.projectID, "user-1", req, "")
	require.Error(t, err)

	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 422, appErr.HTTPStatus)
	assert.Equal(t, domain.ErrCodeTargetNotVerified, appErr.ErrorCode)
}

func TestLoadTestService_SSRF_Blocked(t *testing.T) {
	rig := setupLoadTestRig(t, true, "http://internal.acme.com")
	ctx := context.Background()

	req := domain.CreateLoadTestRequest{
		Name:            "SSRF Test",
		Model:           domain.ModelOpen,
		Profile:         domain.ProfileSustained,
		Targets:         []domain.TargetItemRequest{{Method: "GET", Path: "/admin", Weight: 1}},
		StartRate:       10,
		DurationSeconds: 60,
		StartNow:        true,
	}

	_, err := rig.svc.CreateLoadTest(ctx, rig.orgID, rig.projectID, "user-1", req, "")
	require.Error(t, err)

	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 422, appErr.HTTPStatus)
	assert.Equal(t, domain.ErrCodeTargetBlocked, appErr.ErrorCode)
}

func TestLoadTestService_PlanLimitsExceeded(t *testing.T) {
	rig := setupLoadTestRig(t, true, "https://api.acme.com")
	ctx := context.Background()

	// 1. Rate > 1000
	req := domain.CreateLoadTestRequest{
		Name:            "High Rate",
		Model:           domain.ModelOpen,
		Profile:         domain.ProfileSustained,
		Targets:         []domain.TargetItemRequest{{Method: "GET", Path: "/ping", Weight: 1}},
		StartRate:       2000,
		DurationSeconds: 60,
	}
	_, err := rig.svc.CreateLoadTest(ctx, rig.orgID, rig.projectID, "user-1", req, "")
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodePlanLimitExceeded, appErr.ErrorCode)

	// 2. Duration > 1800
	req.StartRate = 50
	req.DurationSeconds = 3600
	_, err = rig.svc.CreateLoadTest(ctx, rig.orgID, rig.projectID, "user-1", req, "")
	require.Error(t, err)
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodePlanLimitExceeded, appErr.ErrorCode)
}

func TestLoadTestService_Success_And_ConcurrentCap(t *testing.T) {
	rig := setupLoadTestRig(t, true, "https://api.acme.com")
	ctx := context.Background()

	req := domain.CreateLoadTestRequest{
		Name:    "Valid Test",
		Model:   domain.ModelOpen,
		Profile: domain.ProfileRamp,
		Targets: []domain.TargetItemRequest{
			{
				Method: "POST",
				Path:   "/orders",
				Headers: map[string]string{
					"Authorization": "Bearer super-secret-key",
					"Content-Type":  "application/json",
				},
				Weight: 1,
			},
		},
		StartRate:       10,
		PeakRate:        100,
		RampUpSeconds:   30,
		DurationSeconds: 60,
		StartNow:        true,
	}

	created, err := rig.svc.CreateLoadTest(ctx, rig.orgID, rig.projectID, "user-1", req, "")
	require.NoError(t, err)
	require.NotNil(t, created)
	assert.Equal(t, domain.LoadTestStatusQueued, created.Status)
	assert.Equal(t, "***", created.Config.Targets[0].Headers["Authorization"])
	assert.Equal(t, "application/json", created.Config.Targets[0].Headers["Content-Type"])

	// 2. Second attempt while first is queued triggers 409 TEST_ALREADY_RUNNING
	_, err = rig.svc.CreateLoadTest(ctx, rig.orgID, rig.projectID, "user-1", req, "")
	require.Error(t, err)
	var appErr *domain.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, 409, appErr.HTTPStatus)
	assert.Equal(t, domain.ErrCodeTestAlreadyRunning, appErr.ErrorCode)

	// 3. Stop Test
	stopped, err := rig.svc.StopLoadTest(ctx, rig.orgID, rig.projectID, created.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.LoadTestStatusStopped, stopped.Status)

	// 4. Results before completion returns 409 TEST_NOT_FINISHED
	// (Test is stopped without results saved yet)
	_, err = rig.svc.GetResults(ctx, rig.orgID, rig.projectID, created.ID)
	require.Error(t, err)
}
