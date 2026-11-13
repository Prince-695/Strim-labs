package repository

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryDashboardRepository(t *testing.T) {
	ctx := context.Background()
	repo := NewInMemoryDashboardRepository()

	now := time.Now()
	defaultDash := &domain.Dashboard{
		ID:             "dash-default",
		ProjectID:      "proj-1",
		OrgID:          "org-1",
		Name:           "API Overview",
		IsDefault:      true,
		Version:        1,
		TimeRange:      "1h",
		RefreshSeconds: 15,
		Widgets:        "[]",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	customDash := &domain.Dashboard{
		ID:             "dash-custom",
		ProjectID:      "proj-1",
		OrgID:          "org-1",
		Name:           "Custom Performance",
		IsDefault:      false,
		Version:        1,
		TimeRange:      "24h",
		RefreshSeconds: 30,
		Widgets:        "[]",
		CreatedAt:      now.Add(time.Minute),
		UpdatedAt:      now.Add(time.Minute),
	}

	// 1. Create
	require.NoError(t, repo.Create(ctx, defaultDash))
	require.NoError(t, repo.Create(ctx, customDash))

	// 2. FindByID & FindDefaultByProject
	found, err := repo.FindByID(ctx, "proj-1", "dash-default")
	require.NoError(t, err)
	assert.Equal(t, "API Overview", found.Name)

	foundDefault, err := repo.FindDefaultByProject(ctx, "proj-1")
	require.NoError(t, err)
	require.NotNil(t, foundDefault)
	assert.Equal(t, "dash-default", foundDefault.ID)

	// 3. ListByProject (default first)
	list, err := repo.ListByProject(ctx, "proj-1")
	require.NoError(t, err)
	require.Len(t, list, 2)
	assert.True(t, list[0].IsDefault)

	// 4. Optimistic locking update: stale version -> 409 Conflict
	customDash.Name = "Stale Update"
	err = repo.Update(ctx, customDash, 999)
	require.Error(t, err)
	var appErr *domain.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeVersionConflict, appErr.ErrorCode)

	// 5. Successful update with expected version 1 -> increments to 2
	customDash.Name = "Custom Performance Tuned"
	err = repo.Update(ctx, customDash, 1)
	require.NoError(t, err)
	assert.Equal(t, 2, customDash.Version)

	updated, err := repo.FindByID(ctx, "proj-1", "dash-custom")
	require.NoError(t, err)
	assert.Equal(t, 2, updated.Version)
	assert.Equal(t, "Custom Performance Tuned", updated.Name)

	// 6. Delete default dashboard -> must be forbidden
	err = repo.Delete(ctx, "proj-1", "dash-default")
	require.Error(t, err)
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodeDefaultDashboardUndeletable, appErr.ErrorCode)

	// 7. Delete custom dashboard -> succeeds
	err = repo.Delete(ctx, "proj-1", "dash-custom")
	require.NoError(t, err)

	_, err = repo.FindByID(ctx, "proj-1", "dash-custom")
	assert.Error(t, err)
}
