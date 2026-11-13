package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryLoadTestRepository(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewInMemoryLoadTestRepository()

	test := &domain.LoadTest{
		ID:        "test-1",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Test 1",
		Model:     domain.ModelOpen,
		Profile:   domain.ProfileSustained,
		Status:    domain.LoadTestStatusQueued,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	// 1. Create & FindByID
	err := repo.Create(ctx, test)
	require.NoError(t, err)

	found, err := repo.FindByID(ctx, "test-1")
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "Test 1", found.Name)

	// 2. FindActiveByProjectID & FindActiveByOrgID
	active, err := repo.FindActiveByProjectID(ctx, "proj-1")
	require.NoError(t, err)
	require.NotNil(t, active)
	assert.Equal(t, "test-1", active.ID)

	activeOrg, err := repo.FindActiveByOrgID(ctx, "org-1")
	require.NoError(t, err)
	require.NotNil(t, activeOrg)
	assert.Equal(t, "test-1", activeOrg.ID)

	// 3. Update status to completed
	test.Status = domain.LoadTestStatusCompleted
	err = repo.Update(ctx, test)
	require.NoError(t, err)

	active, err = repo.FindActiveByProjectID(ctx, "proj-1")
	require.NoError(t, err)
	assert.Nil(t, active)

	// 4. ListByProjectID
	list, total, err := repo.FindByProjectID(ctx, "proj-1", repository.ListLoadTestsQuery{})
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, 1, len(list))

	// 5. Results & Timeseries
	res := &domain.LoadTestResults{
		TestID: "test-1",
		Summary: domain.JSONMap{
			"total_requests": 100,
		},
		CreatedAt: time.Now().UTC(),
	}
	err = repo.CreateResults(ctx, res)
	require.NoError(t, err)

	gotRes, err := repo.GetResults(ctx, "test-1")
	require.NoError(t, err)
	require.NotNil(t, gotRes)

	tsBatch := []*domain.LoadTestTimeseries{
		{ID: "pt-1", TestID: "test-1", Second: 0, OfferedRPS: 10, AchievedRPS: 10},
		{ID: "pt-2", TestID: "test-1", Second: 1, OfferedRPS: 10, AchievedRPS: 10},
		{ID: "pt-3", TestID: "test-1", Second: 2, OfferedRPS: 10, AchievedRPS: 10},
	}
	err = repo.CreateTimeseriesBatch(ctx, tsBatch)
	require.NoError(t, err)

	pts, err := repo.GetTimeseries(ctx, "test-1", 1)
	require.NoError(t, err)
	assert.Equal(t, 3, len(pts))

	// Stepped query
	steppedPts, err := repo.GetTimeseries(ctx, "test-1", 2)
	require.NoError(t, err)
	assert.Equal(t, 2, len(steppedPts))

	// 6. Delete
	err = repo.Delete(ctx, "test-1")
	require.NoError(t, err)

	found, err = repo.FindByID(ctx, "test-1")
	require.NoError(t, err)
	assert.Nil(t, found)
}

func TestInMemoryJobRepository(t *testing.T) {
	ctx := context.Background()
	jobRepo := repository.NewInMemoryJobRepository()

	job := &domain.Job{
		ID:        "job-1",
		Type:      "load_test_run",
		Payload:   `{"test_id":"test-1"}`,
		Status:    domain.JobStatusQueued,
		RunAt:     time.Now().UTC().Add(-1 * time.Second),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	err := jobRepo.EnqueueJob(ctx, job)
	require.NoError(t, err)

	// Claim
	claimed, err := jobRepo.ClaimJob(ctx, "worker-1")
	require.NoError(t, err)
	require.NotNil(t, claimed)
	assert.Equal(t, "job-1", claimed.ID)
	assert.Equal(t, domain.JobStatusRunning, claimed.Status)
	assert.Equal(t, "worker-1", *claimed.LockedBy)

	// Heartbeat
	err = jobRepo.HeartbeatJob(ctx, "job-1", "worker-1")
	require.NoError(t, err)

	// Complete
	err = jobRepo.CompleteJob(ctx, "job-1")
	require.NoError(t, err)
	assert.Equal(t, domain.JobStatusCompleted, claimed.Status)
}
