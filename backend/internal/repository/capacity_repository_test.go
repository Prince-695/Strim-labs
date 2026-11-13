package repository_test

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryCapacityRepository(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewInMemoryCapacityRepository()

	breakingRPS := 250.0
	reason := domain.BreakingReasonLatency

	report1 := &domain.CapacityReport{
		ID:               "cap-1",
		LoadTestID:       "test-1",
		OrgID:            "org-1",
		ProjectID:        "proj-1",
		SustainableRPS:   200.0,
		BreakingPointRPS: &breakingRPS,
		BreakingReason:   &reason,
		BaselineP95Ms:    20.0,
		Confidence:       domain.ConfidenceHigh,
		Note:             "Found clean breaking point",
		Thresholds: domain.CapacityThresholds{
			P95Multiplier:    2.0,
			MaxErrorRate:     0.01,
			MinAchievedRatio: 0.95,
		},
		Windows: []domain.CapacityWindow{
			{Index: 1, StartSecond: 0, EndSecond: 10, OfferedRPS: 100, AchievedRPS: 100, P95Ms: 20.0, Healthy: true},
			{Index: 2, StartSecond: 10, EndSecond: 20, OfferedRPS: 200, AchievedRPS: 200, P95Ms: 28.0, Healthy: true},
			{Index: 3, StartSecond: 20, EndSecond: 30, OfferedRPS: 250, AchievedRPS: 245, P95Ms: 65.0, Healthy: false, FailureReason: &reason},
		},
		CreatedAt: time.Now().UTC().Add(-10 * time.Minute),
		UpdatedAt: time.Now().UTC().Add(-10 * time.Minute),
	}

	report2 := &domain.CapacityReport{
		ID:             "cap-2",
		LoadTestID:     "test-2",
		OrgID:          "org-1",
		ProjectID:      "proj-1",
		SustainableRPS: 300.0,
		BaselineP95Ms:  22.0,
		Confidence:     domain.ConfidenceMedium,
		Note:           "Capacity at least 300 RPS",
		Thresholds: domain.CapacityThresholds{
			P95Multiplier: 2.0,
			MaxErrorRate:  0.01,
		},
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	reportOtherProject := &domain.CapacityReport{
		ID:             "cap-3",
		LoadTestID:     "test-3",
		OrgID:          "org-1",
		ProjectID:      "proj-2",
		SustainableRPS: 150.0,
		BaselineP95Ms:  30.0,
		Confidence:     domain.ConfidenceLow,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	// 1. Save all reports
	require.NoError(t, repo.Save(ctx, report1))
	require.NoError(t, repo.Save(ctx, report2))
	require.NoError(t, repo.Save(ctx, reportOtherProject))

	// 2. FindByLoadTestID
	found1, err := repo.FindByLoadTestID(ctx, "test-1")
	require.NoError(t, err)
	require.NotNil(t, found1)
	assert.Equal(t, "cap-1", found1.ID)
	assert.Equal(t, 200.0, found1.SustainableRPS)
	assert.Equal(t, 3, len(found1.Windows))
	assert.Equal(t, domain.ConfidenceHigh, found1.Confidence)

	// Mutate returned copy and verify repository copy was not affected
	found1.SustainableRPS = 999.0
	fresh, err := repo.FindByLoadTestID(ctx, "test-1")
	require.NoError(t, err)
	assert.Equal(t, 200.0, fresh.SustainableRPS)

	// Non-existent load test ID returns nil, nil
	notFound, err := repo.FindByLoadTestID(ctx, "non-existent")
	require.NoError(t, err)
	assert.Nil(t, notFound)

	// 3. FindByProjectID
	proj1Reports, err := repo.FindByProjectID(ctx, "proj-1")
	require.NoError(t, err)
	assert.Len(t, proj1Reports, 2)
	// Should be ordered descending by CreatedAt (cap-2 is newer than cap-1)
	assert.Equal(t, "cap-2", proj1Reports[0].ID)
	assert.Equal(t, "cap-1", proj1Reports[1].ID)

	proj2Reports, err := repo.FindByProjectID(ctx, "proj-2")
	require.NoError(t, err)
	assert.Len(t, proj2Reports, 1)
	assert.Equal(t, "cap-3", proj2Reports[0].ID)

	emptyReports, err := repo.FindByProjectID(ctx, "proj-empty")
	require.NoError(t, err)
	assert.Empty(t, emptyReports)

	// 4. Update existing report via Save
	updatedReport1 := *report1
	updatedReport1.SustainableRPS = 220.0
	require.NoError(t, repo.Save(ctx, &updatedReport1))

	reFound, err := repo.FindByLoadTestID(ctx, "test-1")
	require.NoError(t, err)
	assert.Equal(t, 220.0, reFound.SustainableRPS)

	// 5. DeleteByLoadTestID
	require.NoError(t, repo.DeleteByLoadTestID(ctx, "test-1"))
	delFound, err := repo.FindByLoadTestID(ctx, "test-1")
	require.NoError(t, err)
	assert.Nil(t, delFound)

	afterDelReports, err := repo.FindByProjectID(ctx, "proj-1")
	require.NoError(t, err)
	assert.Len(t, afterDelReports, 1)
	assert.Equal(t, "cap-2", afterDelReports[0].ID)
}

func TestInMemoryCapacityRepository_Concurrency(t *testing.T) {
	ctx := context.Background()
	repo := repository.NewInMemoryCapacityRepository()

	var wg sync.WaitGroup
	numRoutines := 20

	for i := 0; i < numRoutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			testID := fmt.Sprintf("test-%d", id)
			report := &domain.CapacityReport{
				ID:             fmt.Sprintf("cap-%d", id),
				LoadTestID:     testID,
				ProjectID:      "proj-concurrency",
				SustainableRPS: float64(100 + id),
				CreatedAt:      time.Now().UTC(),
				UpdatedAt:      time.Now().UTC(),
			}
			_ = repo.Save(ctx, report)
			_, _ = repo.FindByLoadTestID(ctx, testID)
			_, _ = repo.FindByProjectID(ctx, "proj-concurrency")
		}(i)
	}

	wg.Wait()
	reports, err := repo.FindByProjectID(ctx, "proj-concurrency")
	require.NoError(t, err)
	assert.Len(t, reports, numRoutines)
}
