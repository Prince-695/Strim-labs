package service

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupDashboardServiceTest(t *testing.T) (DashboardService, *repository.InMemoryProjectRepository, *repository.InMemoryDashboardRepository) {
	dashRepo := repository.NewInMemoryDashboardRepository()
	projectRepo := repository.NewInMemoryProjectRepository()
	auditRepo := repository.NewInMemoryAuditLogRepository()
	auditRec := audit.NewAsyncRecorder(auditRepo)

	svc := NewDashboardService(dashRepo, projectRepo, auditRec)

	ctx := context.Background()
	_ = projectRepo.CreateWithLimitCheck(ctx, &domain.Project{
		ID:      "proj-1",
		OrgID:   "org-1",
		Name:    "Test Project",
		Slug:    "test-project",
		BaseURL: "https://api.example.com",
	})

	return svc, projectRepo, dashRepo
}

func TestDashboardService_CreateAndGet(t *testing.T) {
	svc, _, _ := setupDashboardServiceTest(t)
	ctx := context.Background()

	// 1. Valid creation
	req := domain.CreateDashboardRequest{
		Name: "Custom Perf",
		Widgets: []domain.Widget{
			{
				Type:  domain.WidgetTypeTimeseries,
				Title: "Latency P99",
				Layout: domain.WidgetLayout{
					X: 0,
					Y: 0,
					W: 6,
					H: 4,
				},
				Query: domain.WidgetQuery{
					Metric:  "p99",
					GroupBy: "endpoint",
				},
			},
		},
	}

	created, err := svc.CreateDashboard(ctx, "org-1", "proj-1", req)
	require.NoError(t, err)
	require.NotEmpty(t, created.ID)
	assert.Equal(t, "Custom Perf", created.Name)
	assert.False(t, created.IsDefault)
	assert.Equal(t, 1, created.Version)
	assert.Equal(t, "1h", created.TimeRange)
	assert.Equal(t, 15, created.RefreshSeconds)
	require.Len(t, created.Widgets, 1)
	assert.NotEmpty(t, created.Widgets[0].ID) // ID auto-assigned
	assert.Equal(t, "Latency P99", created.Widgets[0].Title)

	// 2. Fetch by ID
	fetched, err := svc.GetDashboard(ctx, "org-1", "proj-1", created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, fetched.ID)
	assert.Equal(t, "Custom Perf", fetched.Name)
	assert.Len(t, fetched.Widgets, 1)

	// 3. Not found
	_, err = svc.GetDashboard(ctx, "org-1", "proj-1", "non-existent")
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeDashboardNotFound, appErr.ErrorCode)

	// 4. Invalid project
	_, err = svc.CreateDashboard(ctx, "org-1", "proj-999", req)
	require.Error(t, err)
}

func TestDashboardService_CreateValidationFailures(t *testing.T) {
	svc, _, _ := setupDashboardServiceTest(t)
	ctx := context.Background()

	// Empty name
	_, err := svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name: "",
		Widgets: []domain.Widget{
			{Type: domain.WidgetTypeTimeseries, Title: "W", Query: domain.WidgetQuery{Metric: "p95"}},
		},
	})
	assert.Error(t, err)

	// No widgets
	_, err = svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name:    "Empty",
		Widgets: []domain.Widget{},
	})
	assert.Error(t, err)

	// Invalid metric
	_, err = svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name: "Invalid Metric",
		Widgets: []domain.Widget{
			{Type: domain.WidgetTypeTimeseries, Title: "SQL Injection", Query: domain.WidgetQuery{Metric: "SELECT * FROM users"}},
		},
	})
	assert.Error(t, err)

	// Invalid widget type
	_, err = svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name: "Invalid Type",
		Widgets: []domain.Widget{
			{Type: "gauge_3d", Title: "3D", Query: domain.WidgetQuery{Metric: "p50"}},
		},
	})
	assert.Error(t, err)

	// > 30 widgets
	manyWidgets := make([]domain.Widget, 31)
	for i := 0; i < 31; i++ {
		manyWidgets[i] = domain.Widget{
			Type:  domain.WidgetTypeStat,
			Title: fmt.Sprintf("W%d", i),
			Query: domain.WidgetQuery{Metric: "rps"},
		}
	}
	_, err = svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name:    "Too Many",
		Widgets: manyWidgets,
	})
	assert.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeTooManyWidgets, appErr.ErrorCode)
}

func TestDashboardService_ListAndAutoSeed(t *testing.T) {
	svc, _, _ := setupDashboardServiceTest(t)
	ctx := context.Background()

	// Listing on empty project triggers auto-seeding of "API Overview"
	list, err := svc.ListDashboards(ctx, "org-1", "proj-1")
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "API Overview", list[0].Name)
	assert.True(t, list[0].IsDefault)

	// Fetch full seeded dashboard
	full, err := svc.GetDashboard(ctx, "org-1", "proj-1", list[0].ID)
	require.NoError(t, err)
	assert.True(t, full.IsDefault)
	assert.Len(t, full.Widgets, 4) // 4 standard widgets
}

func TestDashboardService_UpdateAndOptimisticLocking(t *testing.T) {
	svc, _, _ := setupDashboardServiceTest(t)
	ctx := context.Background()

	created, err := svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name: "Before Update",
		Widgets: []domain.Widget{
			{Type: domain.WidgetTypeTimeseries, Title: "Latency", Query: domain.WidgetQuery{Metric: "p90"}},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, created.Version)

	// 1. Conflict on mismatched version
	newName := "After Update"
	_, err = svc.UpdateDashboard(ctx, "org-1", "proj-1", created.ID, domain.UpdateDashboardRequest{
		Version: 999, // Mismatched
		Name:    &newName,
	})
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeVersionConflict, appErr.ErrorCode)

	// 2. Successful update with expected version
	updated, err := svc.UpdateDashboard(ctx, "org-1", "proj-1", created.ID, domain.UpdateDashboardRequest{
		Version: 1,
		Name:    &newName,
	})
	require.NoError(t, err)
	assert.Equal(t, "After Update", updated.Name)
	assert.Equal(t, 2, updated.Version)

	// 3. Second update with version 2
	newTimeRange := "24h"
	updated2, err := svc.UpdateDashboard(ctx, "org-1", "proj-1", created.ID, domain.UpdateDashboardRequest{
		Version:   2,
		TimeRange: &newTimeRange,
	})
	require.NoError(t, err)
	assert.Equal(t, "24h", updated2.TimeRange)
	assert.Equal(t, 3, updated2.Version)
}

func TestDashboardService_DeleteAndDefaultProtection(t *testing.T) {
	svc, _, _ := setupDashboardServiceTest(t)
	ctx := context.Background()

	// Auto-seed default dashboard
	defaultDash, err := svc.SeedDefaultDashboard(ctx, "org-1", "proj-1")
	require.NoError(t, err)
	assert.True(t, defaultDash.IsDefault)

	// 1. Deleting default dashboard must fail
	err = svc.DeleteDashboard(ctx, "org-1", "proj-1", defaultDash.ID)
	require.Error(t, err)
	appErr, ok := err.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeDefaultDashboardUndeletable, appErr.ErrorCode)

	// 2. Custom dashboard can be deleted
	custom, err := svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name: "Temporary",
		Widgets: []domain.Widget{
			{Type: domain.WidgetTypeStat, Title: "RPS", Query: domain.WidgetQuery{Metric: "rps"}},
		},
	})
	require.NoError(t, err)

	err = svc.DeleteDashboard(ctx, "org-1", "proj-1", custom.ID)
	require.NoError(t, err)

	// Verify not found
	_, err = svc.GetDashboard(ctx, "org-1", "proj-1", custom.ID)
	assert.Error(t, err)
}

func TestDashboardService_Clone(t *testing.T) {
	svc, _, _ := setupDashboardServiceTest(t)
	ctx := context.Background()

	// Seed default
	defaultDash, err := svc.SeedDefaultDashboard(ctx, "org-1", "proj-1")
	require.NoError(t, err)
	require.Len(t, defaultDash.Widgets, 4)

	// 1. Clone with default name suffix
	cloned1, err := svc.CloneDashboard(ctx, "org-1", "proj-1", defaultDash.ID, domain.CloneDashboardRequest{})
	require.NoError(t, err)
	assert.NotEqual(t, defaultDash.ID, cloned1.ID)
	assert.Equal(t, "API Overview (copy)", cloned1.Name)
	assert.False(t, cloned1.IsDefault)
	assert.Equal(t, 1, cloned1.Version)
	require.Len(t, cloned1.Widgets, 4)

	// Ensure widget IDs were re-generated
	assert.NotEqual(t, defaultDash.Widgets[0].ID, cloned1.Widgets[0].ID)

	// 2. Clone with custom name
	cloned2, err := svc.CloneDashboard(ctx, "org-1", "proj-1", defaultDash.ID, domain.CloneDashboardRequest{
		Name: "Staging Overview",
	})
	require.NoError(t, err)
	assert.Equal(t, "Staging Overview", cloned2.Name)
}

func TestDashboardService_ConcurrencyAndRace(t *testing.T) {
	svc, _, _ := setupDashboardServiceTest(t)
	ctx := context.Background()

	created, err := svc.CreateDashboard(ctx, "org-1", "proj-1", domain.CreateDashboardRequest{
		Name: "Base",
		Widgets: []domain.Widget{
			{Type: domain.WidgetTypeTimeseries, Title: "W", Query: domain.WidgetQuery{Metric: "p95"}},
		},
	})
	require.NoError(t, err)

	var wg sync.WaitGroup
	workers := 10
	wg.Add(workers)

	for i := 0; i < workers; i++ {
		go func(id int) {
			defer wg.Done()
			_, _ = svc.GetDashboard(ctx, "org-1", "proj-1", created.ID)
			_, _ = svc.ListDashboards(ctx, "org-1", "proj-1")
			_, _ = svc.CloneDashboard(ctx, "org-1", "proj-1", created.ID, domain.CloneDashboardRequest{
				Name: fmt.Sprintf("Clone %d", id),
			})
		}(i)
	}

	wg.Wait()
}
