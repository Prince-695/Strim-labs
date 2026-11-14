package alerts_test

import (
	"context"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/alerts"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockDispatcher struct {
	dispatched []domain.IncidentEventType
}

func (m *mockDispatcher) Dispatch(ctx context.Context, channel *domain.NotificationChannel, incident *domain.Incident, rule *domain.AlertRule, eventType domain.IncidentEventType) error {
	m.dispatched = append(m.dispatched, eventType)
	return nil
}

func (m *mockDispatcher) TestSend(ctx context.Context, channel *domain.NotificationChannel) error {
	return nil
}

type evaluatorTestRig struct {
	evaluator    *alerts.Evaluator
	alertRepo    repository.AlertRuleRepository
	incidentRepo repository.IncidentRepository
	channelRepo  repository.NotificationChannelRepository
	endpointRepo repository.EndpointRepository
	store        ingest.TimeSeriesStore
	dispatcher   *mockDispatcher
	clk          *clock.MockClock
}

func setupEvaluatorTestRig() *evaluatorTestRig {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	mockClk := clock.NewMockClock(now)

	alertRepo := repository.NewInMemoryAlertRuleRepository()
	incidentRepo := repository.NewInMemoryIncidentRepository()
	channelRepo := repository.NewInMemoryNotificationChannelRepository()
	endpointRepo := repository.NewInMemoryEndpointRepository()
	store := ingest.NewInMemoryTimeSeriesStore()
	dispatcher := &mockDispatcher{}
	idGen := ids.NewUUIDv7Generator()

	evaluator := alerts.NewEvaluator(
		alertRepo,
		incidentRepo,
		channelRepo,
		endpointRepo,
		store,
		dispatcher,
		mockClk,
		idGen,
		nil,
	)

	return &evaluatorTestRig{
		evaluator:    evaluator,
		alertRepo:    alertRepo,
		incidentRepo: incidentRepo,
		channelRepo:  channelRepo,
		endpointRepo: endpointRepo,
		store:        store,
		dispatcher:   dispatcher,
		clk:          mockClk,
	}
}

func TestEvaluator_ImmediateFiringAndAutoResolution(t *testing.T) {
	rig := setupEvaluatorTestRig()
	ctx := context.Background()
	now := rig.clk.Now()

	// 1. Setup channel
	ch := &domain.NotificationChannel{
		ID:        "ch-1",
		ProjectID: "proj-1",
		Type:      domain.ChannelTypeSlack,
		Enabled:   true,
	}
	require.NoError(t, rig.channelRepo.Create(ctx, ch))

	// 2. Setup alert rule: error_rate > 0.05, for: 0m (immediate)
	rule := &domain.AlertRule{
		ID:        "rule-immediate",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Spike Alert",
		Enabled:   true,
		Version:   1,
		Severity:  domain.AlertSeverityCritical,
		State:     domain.AlertStateOK,
		Condition: domain.JSONMap{
			"metric":    "error_rate",
			"operator":  ">",
			"threshold": 0.05,
			"window":    "5m",
			"for":       "0m",
		},
		ChannelIDs: domain.ChannelIDsToJSONMap([]string{"ch-1"}),
		CreatedAt:  now,
	}
	require.NoError(t, rig.alertRepo.Create(ctx, rule))

	// Ingest error events: 10 events, 2 errors (20% > 5%)
	events := make([]domain.RequestEvent, 10)
	for i := 0; i < 10; i++ {
		status := 200
		if i < 2 {
			status = 500
		}
		events[i] = domain.RequestEvent{
			ProjectID:  "proj-1",
			Method:     "POST",
			Route:      "/api/checkout",
			Status:     status,
			DurationMs: 50,
			Timestamp:  now.Add(-1 * time.Minute),
		}
	}
	require.NoError(t, rig.store.WriteEvents(ctx, events))

	// 3. Evaluate -> Rule should transition to FIRING immediately and open incident
	require.NoError(t, rig.evaluator.EvaluateAll(ctx))

	updatedRule, err := rig.alertRepo.FindByID(ctx, "proj-1", "rule-immediate")
	require.NoError(t, err)
	assert.Equal(t, domain.AlertStateFiring, updatedRule.State)
	assert.NotNil(t, updatedRule.LastTriggeredAt)

	openInc, err := rig.incidentRepo.FindOpenByRuleID(ctx, "proj-1", "rule-immediate")
	require.NoError(t, err)
	require.NotNil(t, openInc)
	assert.Equal(t, domain.IncidentStatusOpen, openInc.Status)
	assert.Equal(t, 0.20, openInc.CurrentValue)
	assert.Equal(t, domain.AlertSeverityCritical, openInc.Severity)

	timeline, err := rig.incidentRepo.GetTimeline(ctx, openInc.ID)
	require.NoError(t, err)
	require.Len(t, timeline, 1)
	assert.Equal(t, domain.IncidentEventOpened, timeline[0].Type)

	require.Len(t, rig.dispatcher.dispatched, 1)
	assert.Equal(t, domain.IncidentEventOpened, rig.dispatcher.dispatched[0])

	// 4. Metric recovers: advance clock by 5m, ingest 10 clean events
	rig.clk.Advance(5 * time.Minute)
	cleanNow := rig.clk.Now()

	cleanEvents := make([]domain.RequestEvent, 10)
	for i := 0; i < 10; i++ {
		cleanEvents[i] = domain.RequestEvent{
			ProjectID:  "proj-1",
			Method:     "POST",
			Route:      "/api/checkout",
			Status:     200,
			DurationMs: 25,
			Timestamp:  cleanNow.Add(-1 * time.Minute),
		}
	}
	require.NoError(t, rig.store.WriteEvents(ctx, cleanEvents))

	// Evaluate -> Rule should auto-resolve
	require.NoError(t, rig.evaluator.EvaluateAll(ctx))

	resolvedRule, err := rig.alertRepo.FindByID(ctx, "proj-1", "rule-immediate")
	require.NoError(t, err)
	assert.Equal(t, domain.AlertStateResolved, resolvedRule.State)

	resolvedInc, err := rig.incidentRepo.FindByID(ctx, "proj-1", openInc.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.IncidentStatusResolved, resolvedInc.Status)
	assert.True(t, resolvedInc.AutoResolved)

	timelineAfter, _ := rig.incidentRepo.GetTimeline(ctx, openInc.ID)
	require.Len(t, timelineAfter, 2)
	assert.Equal(t, domain.IncidentEventResolved, timelineAfter[1].Type)

	require.Len(t, rig.dispatcher.dispatched, 2)
	assert.Equal(t, domain.IncidentEventResolved, rig.dispatcher.dispatched[1])
}

func TestEvaluator_HysteresisAndAntiFlapping(t *testing.T) {
	rig := setupEvaluatorTestRig()
	ctx := context.Background()
	now := rig.clk.Now()

	// Rule with for: 2m
	rule := &domain.AlertRule{
		ID:        "rule-hysteresis",
		OrgID:     "org-1",
		ProjectID: "proj-1",
		Name:      "Latency Rule with Hysteresis",
		Enabled:   true,
		Version:   1,
		Severity:  domain.AlertSeverityWarning,
		State:     domain.AlertStateOK,
		Condition: domain.JSONMap{
			"metric":    "latency_p95",
			"operator":  ">",
			"threshold": 100.0,
			"window":    "5m",
			"for":       "2m",
		},
		CreatedAt: now,
	}
	require.NoError(t, rig.alertRepo.Create(ctx, rule))

	// Ingest high latency events (P95 = 200ms > 100ms)
	events := make([]domain.RequestEvent, 10)
	for i := 0; i < 10; i++ {
		events[i] = domain.RequestEvent{
			ProjectID:  "proj-1",
			Method:     "GET",
			Route:      "/data",
			Status:     200,
			DurationMs: 200,
			Timestamp:  now.Add(-30 * time.Second),
		}
	}
	require.NoError(t, rig.store.WriteEvents(ctx, events))

	// 1. First evaluation: enters PENDING state (pending_since = now)
	require.NoError(t, rig.evaluator.EvaluateAll(ctx))

	r1, _ := rig.alertRepo.FindByID(ctx, "proj-1", "rule-hysteresis")
	assert.Equal(t, domain.AlertStatePending, r1.State)
	assert.NotNil(t, r1.PendingSince)

	// No incident opened yet!
	openInc, _ := rig.incidentRepo.FindOpenByRuleID(ctx, "proj-1", "rule-hysteresis")
	assert.Nil(t, openInc)

	// 2. Advance 1 minute (less than 2m required for duration)
	rig.clk.Advance(1 * time.Minute)
	require.NoError(t, rig.evaluator.EvaluateAll(ctx))
	r2, _ := rig.alertRepo.FindByID(ctx, "proj-1", "rule-hysteresis")
	assert.Equal(t, domain.AlertStatePending, r2.State) // Still pending

	// 3. Transient recovery scenario: 200 fast requests dilute the spike so P95 drops to 20ms!
	rig.clk.Advance(30 * time.Second)
	recNow := rig.clk.Now()
	cleanEvents := make([]domain.RequestEvent, 200)
	for i := 0; i < 200; i++ {
		cleanEvents[i] = domain.RequestEvent{
			ProjectID:  "proj-1",
			Method:     "GET",
			Route:      "/data",
			Status:     200,
			DurationMs: 20,
			Timestamp:  recNow.Add(-10 * time.Second),
		}
	}
	require.NoError(t, rig.store.WriteEvents(ctx, cleanEvents))

	require.NoError(t, rig.evaluator.EvaluateAll(ctx))
	rRecovered, _ := rig.alertRepo.FindByID(ctx, "proj-1", "rule-hysteresis")
	// Anti-flapping kicked in! Transitioned back to OK without firing!
	assert.Equal(t, domain.AlertStateOK, rRecovered.State)
	assert.Nil(t, rRecovered.PendingSince)
	assert.Empty(t, rig.dispatcher.dispatched)
}

func TestEvaluator_MutedRuleSkipsFiring(t *testing.T) {
	rig := setupEvaluatorTestRig()
	ctx := context.Background()
	now := rig.clk.Now()

	mutedUntil := now.Add(1 * time.Hour)
	rule := &domain.AlertRule{
		ID:         "rule-muted",
		OrgID:      "org-1",
		ProjectID:  "proj-1",
		Name:       "Muted Alert",
		Enabled:    true,
		Version:    1,
		State:      domain.AlertStateMuted,
		MutedUntil: &mutedUntil,
		Condition: domain.JSONMap{
			"metric":    "error_rate",
			"operator":  ">",
			"threshold": 0.01,
			"window":    "5m",
			"for":       "0m",
		},
		CreatedAt: now,
	}
	require.NoError(t, rig.alertRepo.Create(ctx, rule))

	// Ingest 100% 500 errors
	events := []domain.RequestEvent{
		{ProjectID: "proj-1", Method: "GET", Route: "/fail", Status: 500, DurationMs: 10, Timestamp: now.Add(-10 * time.Second)},
	}
	require.NoError(t, rig.store.WriteEvents(ctx, events))

	// Evaluate while muted
	require.NoError(t, rig.evaluator.EvaluateAll(ctx))

	r, _ := rig.alertRepo.FindByID(ctx, "proj-1", "rule-muted")
	assert.Equal(t, domain.AlertStateMuted, r.State)
	assert.Empty(t, rig.dispatcher.dispatched)

	// Advance past mutedUntil
	rig.clk.Advance(2 * time.Hour)
	require.NoError(t, rig.evaluator.EvaluateAll(ctx))

	rAfter, _ := rig.alertRepo.FindByID(ctx, "proj-1", "rule-muted")
	// Now unmuted and evaluated
	assert.Equal(t, domain.AlertStateOK, rAfter.State)
}
