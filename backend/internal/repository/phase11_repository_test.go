package repository

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInMemoryAPIKeyRepository(t *testing.T) {
	ctx := context.Background()
	repo := NewInMemoryAPIKeyRepository()

	now := time.Now()
	key := &domain.APIKey{
		ID:        "key-1",
		ProjectID: "proj-1",
		OrgID:     "org-1",
		Name:      "Test Key",
		Prefix:    "strim_live_1234",
		KeyHash:   domain.HashSecret("raw-secret-1234"),
		Scopes:    domain.StringArray{"ingest", "discovery"},
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Create
	err := repo.Create(ctx, key)
	require.NoError(t, err)

	// FindByID
	found, err := repo.FindByID(ctx, "proj-1", "key-1")
	require.NoError(t, err)
	assert.Equal(t, "Test Key", found.Name)

	// FindByHash
	foundByHash, err := repo.FindByHash(ctx, key.KeyHash)
	require.NoError(t, err)
	assert.Equal(t, "key-1", foundByHash.ID)

	// ListByProject
	list, err := repo.ListByProject(ctx, "proj-1")
	require.NoError(t, err)
	assert.Len(t, list, 1)

	// UpdateLastUsed
	usedTime := time.Now()
	err = repo.UpdateLastUsed(ctx, "key-1", usedTime)
	require.NoError(t, err)
	updated, _ := repo.FindByID(ctx, "proj-1", "key-1")
	assert.NotNil(t, updated.LastUsedAt)

	// Revoke
	revTime := time.Now()
	err = repo.Revoke(ctx, "proj-1", "key-1", revTime)
	require.NoError(t, err)
	revoked, _ := repo.FindByID(ctx, "proj-1", "key-1")
	assert.NotNil(t, revoked.RevokedAt)
	assert.False(t, revoked.IsActive(time.Now()))
}

func TestInMemoryWebhookRepository(t *testing.T) {
	ctx := context.Background()
	repo := NewInMemoryWebhookRepository()

	hook := &domain.Webhook{
		ID:        "wh-1",
		ProjectID: "proj-1",
		OrgID:     "org-1",
		URL:       "https://example.com/webhook",
		Secret:    "hmac-secret-123",
		Events:    domain.StringArray{string(domain.EventTestCompleted)},
		Active:    true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err := repo.Create(ctx, hook)
	require.NoError(t, err)

	// FindByID
	found, err := repo.FindByID(ctx, "proj-1", "wh-1")
	require.NoError(t, err)
	assert.Equal(t, "https://example.com/webhook", found.URL)

	// ListActiveByProjectAndEvent
	activeMatching, err := repo.ListActiveByProjectAndEvent(ctx, "proj-1", domain.EventTestCompleted)
	require.NoError(t, err)
	assert.Len(t, activeMatching, 1)

	nonMatching, err := repo.ListActiveByProjectAndEvent(ctx, "proj-1", domain.EventIncidentOpened)
	require.NoError(t, err)
	assert.Empty(t, nonMatching)

	// Delete
	err = repo.Delete(ctx, "proj-1", "wh-1")
	require.NoError(t, err)
	_, err = repo.FindByID(ctx, "proj-1", "wh-1")
	assert.Error(t, err)
}

func TestInMemoryWebhookDeliveryRepository(t *testing.T) {
	ctx := context.Background()
	repo := NewInMemoryWebhookDeliveryRepository()

	del := &domain.WebhookDelivery{
		ID:         "del-1",
		WebhookID:  "wh-1",
		ProjectID:  "proj-1",
		OrgID:      "org-1",
		Event:      domain.EventTestCompleted,
		Status:     "success",
		StatusCode: 200,
		CreatedAt:  time.Now(),
	}

	err := repo.Create(ctx, del)
	require.NoError(t, err)

	deliveries, err := repo.ListByWebhook(ctx, "wh-1", "success", 10, "")
	require.NoError(t, err)
	assert.Len(t, deliveries, 1)
	assert.Equal(t, 200, deliveries[0].StatusCode)
}

func TestInMemoryAuditLogRepository(t *testing.T) {
	ctx := context.Background()
	repo := NewInMemoryAuditLogRepository()

	t1 := time.Now().Add(-10 * time.Minute)
	t2 := time.Now().Add(-5 * time.Minute)

	err := repo.Append(ctx, &domain.AuditLog{
		ID:           "aud-1",
		OrgID:        "org-1",
		At:           t1,
		ActorID:      "user-1",
		ActorEmail:   "alice@strimlabs.dev",
		Action:       "member.added",
		ResourceType: "member",
		ResourceID:   "user-2",
		IP:           "127.0.0.1",
		UserAgent:    "curl/8.0",
	})
	require.NoError(t, err)

	err = repo.Append(ctx, &domain.AuditLog{
		ID:           "aud-2",
		OrgID:        "org-1",
		At:           t2,
		ActorID:      "user-1",
		ActorEmail:   "alice@strimlabs.dev",
		Action:       "api_key.created",
		ResourceType: "api_key",
		ResourceID:   "key-1",
		IP:           "127.0.0.1",
		UserAgent:    "curl/8.0",
	})
	require.NoError(t, err)

	// List all for org
	list, err := repo.List(ctx, domain.AuditLogFilter{OrgID: "org-1", Limit: 10})
	require.NoError(t, err)
	assert.Len(t, list, 2)
	assert.Equal(t, "aud-2", list[0].ID) // Newest first

	// Filter by action
	filtered, err := repo.List(ctx, domain.AuditLogFilter{OrgID: "org-1", Action: "member.added"})
	require.NoError(t, err)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "aud-1", filtered[0].ID)
}

func TestInMemoryUsageRepository(t *testing.T) {
	ctx := context.Background()
	repo := NewInMemoryUsageRepository()

	date1 := "2026-11-01"
	date2 := "2026-11-02"

	// Day 1
	err := repo.IncrementCounters(ctx, "org-1", date1, 100, 5, 200)
	require.NoError(t, err)

	// Increment Day 1 again
	err = repo.IncrementCounters(ctx, "org-1", date1, 50, 2, 100)
	require.NoError(t, err)

	// Day 2
	err = repo.IncrementCounters(ctx, "org-1", date2, 200, 10, 400)
	require.NoError(t, err)

	// Get daily usage
	daily, err := repo.GetDailyUsage(ctx, "org-1", "2026-11-01", "2026-11-02")
	require.NoError(t, err)
	assert.Len(t, daily, 2)
	assert.Equal(t, int64(150), daily[0].EventsIngested)
	assert.Equal(t, int64(7), daily[0].LoadTestMinutes)
	assert.Equal(t, int64(300), daily[0].RequestsGenerated)

	// Get monthly totals
	ev, min, reqs, err := repo.GetMonthlyTotals(ctx, "org-1", "2026-11")
	require.NoError(t, err)
	assert.Equal(t, int64(350), ev)
	assert.Equal(t, int64(17), min)
	assert.Equal(t, int64(700), reqs)
}
