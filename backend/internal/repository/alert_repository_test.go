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

func TestAlertRuleRepository_OptimisticLockingAndLifecycle(t *testing.T) {
	repo := repository.NewInMemoryAlertRuleRepository()
	ctx := context.Background()
	now := time.Now().UTC()

	rule := &domain.AlertRule{
		ID:          "rule-1",
		OrgID:       "org-1",
		ProjectID:   "proj-1",
		Name:        "Initial Rule",
		Description: "Initial description",
		Enabled:     true,
		Version:     1,
		Severity:    domain.AlertSeverityWarning,
		State:       domain.AlertStateOK,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// 1. Create
	require.NoError(t, repo.Create(ctx, rule))

	// 2. Find
	found, err := repo.FindByID(ctx, "proj-1", "rule-1")
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, 1, found.Version)

	// 3. Successful update with expected version 1 -> version becomes 2
	rule.Name = "Updated Rule Name"
	err = repo.Update(ctx, rule, 1)
	require.NoError(t, err)
	assert.Equal(t, 2, rule.Version)

	found2, err := repo.FindByID(ctx, "proj-1", "rule-1")
	require.NoError(t, err)
	assert.Equal(t, 2, found2.Version)
	assert.Equal(t, "Updated Rule Name", found2.Name)

	// 4. Stale update with old version 1 -> Version conflict error!
	ruleStale := &domain.AlertRule{
		ID:        "rule-1",
		ProjectID: "proj-1",
		Name:      "Concurrent Update Attempt",
	}
	errConflict := repo.Update(ctx, ruleStale, 1)
	assert.Error(t, errConflict)
	appErr, ok := errConflict.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeVersionConflict, appErr.ErrorCode)

	// 5. Update state
	evalAt := now.Add(5 * time.Minute)
	require.NoError(t, repo.UpdateState(ctx, "rule-1", domain.AlertStateFiring, &now, &evalAt, &evalAt))
	found3, _ := repo.FindByID(ctx, "proj-1", "rule-1")
	assert.Equal(t, domain.AlertStateFiring, found3.State)

	// 6. Mute
	mutedUntil := now.Add(1 * time.Hour)
	require.NoError(t, repo.Mute(ctx, "proj-1", "rule-1", mutedUntil))
	found4, _ := repo.FindByID(ctx, "proj-1", "rule-1")
	assert.Equal(t, domain.AlertStateMuted, found4.State)
	assert.NotNil(t, found4.MutedUntil)

	// 7. Delete
	require.NoError(t, repo.Delete(ctx, "proj-1", "rule-1"))
	deleted, err := repo.FindByID(ctx, "proj-1", "rule-1")
	require.NoError(t, err)
	assert.Nil(t, deleted)
}

func TestIncidentRepository_LifecycleAndTimeline(t *testing.T) {
	repo := repository.NewInMemoryIncidentRepository()
	ctx := context.Background()
	now := time.Now().UTC()

	inc := &domain.Incident{
		ID:             "inc-1",
		OrgID:          "org-1",
		ProjectID:      "proj-1",
		RuleID:         "rule-1",
		Status:         domain.IncidentStatusOpen,
		Severity:       domain.AlertSeverityCritical,
		Title:          "5xx Spike Alert",
		CurrentValue:   0.15,
		ThresholdValue: 0.05,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// 1. Create
	require.NoError(t, repo.Create(ctx, inc))

	// 2. FindOpenByRuleID
	openInc, err := repo.FindOpenByRuleID(ctx, "proj-1", "rule-1")
	require.NoError(t, err)
	require.NotNil(t, openInc)
	assert.Equal(t, "inc-1", openInc.ID)

	// 3. Add timeline events
	require.NoError(t, repo.AddEvent(ctx, &domain.IncidentEvent{
		ID:         "ev-1",
		IncidentID: "inc-1",
		Type:       domain.IncidentEventOpened,
		Actor:      "system",
		Detail:     "Error rate exceeded 0.05",
		At:         now,
	}))

	ackUser := "admin@strimlabs.dev"
	ackTime := now.Add(2 * time.Minute)
	require.NoError(t, repo.UpdateStatus(ctx, "proj-1", "inc-1", domain.IncidentStatusAcknowledged, &ackUser, ackTime, false))
	require.NoError(t, repo.AddEvent(ctx, &domain.IncidentEvent{
		ID:         "ev-2",
		IncidentID: "inc-1",
		Type:       domain.IncidentEventAcknowledged,
		Actor:      ackUser,
		Detail:     "Investigating upstream gateway",
		At:         ackTime,
	}))

	timeline, err := repo.GetTimeline(ctx, "inc-1")
	require.NoError(t, err)
	require.Len(t, timeline, 2)
	assert.Equal(t, domain.IncidentEventOpened, timeline[0].Type)
	assert.Equal(t, domain.IncidentEventAcknowledged, timeline[1].Type)

	// 4. Resolve
	resTime := now.Add(10 * time.Minute)
	require.NoError(t, repo.UpdateStatus(ctx, "proj-1", "inc-1", domain.IncidentStatusResolved, nil, resTime, true))
	resolved, err := repo.FindByID(ctx, "proj-1", "inc-1")
	require.NoError(t, err)
	assert.Equal(t, domain.IncidentStatusResolved, resolved.Status)
	assert.True(t, resolved.AutoResolved)

	// No longer returned by FindOpenByRuleID
	openIncAfter, err := repo.FindOpenByRuleID(ctx, "proj-1", "rule-1")
	require.NoError(t, err)
	assert.Nil(t, openIncAfter)
}

func TestNotificationChannelRepository_CRUD(t *testing.T) {
	repo := repository.NewInMemoryNotificationChannelRepository()
	ctx := context.Background()
	now := time.Now().UTC()

	ch := &domain.NotificationChannel{
		ID:        "ch-slack-1",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Type:      domain.ChannelTypeSlack,
		Name:      "#team-devops",
		Config: domain.JSONMap{
			"webhook_url": "https://hooks.slack.com/services/test",
		},
		Enabled:   true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	require.NoError(t, repo.Create(ctx, ch))

	found, err := repo.FindByID(ctx, "proj-1", "ch-slack-1")
	require.NoError(t, err)
	require.NotNil(t, found)
	assert.Equal(t, "#team-devops", found.Name)

	ch.Name = "#devops-critical"
	require.NoError(t, repo.Update(ctx, ch))

	list, err := repo.ListByProject(ctx, "proj-1")
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "#devops-critical", list[0].Name)

	require.NoError(t, repo.LogDispatch(ctx, &domain.NotificationLog{
		ID:         "log-1",
		ChannelID:  "ch-slack-1",
		IncidentID: "inc-1",
		Type:       domain.ChannelTypeSlack,
		Status:     "success",
		SentAt:     now,
	}))

	require.NoError(t, repo.Delete(ctx, "proj-1", "ch-slack-1"))
	deleted, _ := repo.FindByID(ctx, "proj-1", "ch-slack-1")
	assert.Nil(t, deleted)
}
