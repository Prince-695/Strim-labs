package service_test

import (
	"context"
	"net"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/notify"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockResolver struct {
	ips map[string][]net.IP
}

func (m *mockResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	if ips, ok := m.ips[host]; ok {
		return ips, nil
	}
	return nil, &net.DNSError{Err: "no such host", Name: host}
}

type alertServicesTestRig struct {
	alertSvc     service.AlertService
	incidentSvc  service.IncidentService
	channelSvc   service.NotificationService
	alertRepo    repository.AlertRuleRepository
	incidentRepo repository.IncidentRepository
	channelRepo  repository.NotificationChannelRepository
	endpointRepo repository.EndpointRepository
	projectRepo  repository.ProjectRepository
	clk          *clock.MockClock
}

func setupAlertServicesRig(t *testing.T) *alertServicesTestRig {
	now := time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)
	clk := clock.NewMockClock(now)
	idGen := ids.NewUUIDv7Generator()

	alertRepo := repository.NewInMemoryAlertRuleRepository()
	incidentRepo := repository.NewInMemoryIncidentRepository()
	channelRepo := repository.NewInMemoryNotificationChannelRepository()
	endpointRepo := repository.NewInMemoryEndpointRepository()
	projectRepo := repository.NewInMemoryProjectRepository()

	// Seed test project
	ctx := context.Background()
	proj := &domain.Project{
		ID:        "proj-test",
		OrgID:     "org-test",
		Name:      "Monitoring Target API",
		Slug:      "target-api",
		BaseURL:   "https://api.acme.com",
		CreatedAt: now,
		UpdatedAt: now,
	}
	require.NoError(t, projectRepo.CreateWithLimitCheck(ctx, proj))

	res := &mockResolver{
		ips: map[string][]net.IP{
			"hooks.slack.com": {net.ParseIP("93.184.216.34")},
			"api.webhook.com": {net.ParseIP("93.184.216.35")},
			"internal.local":  {net.ParseIP("127.0.0.1")},
		},
	}
	ssrfGuard := netguard.NewSSRFGuard(res)
	dispatcher := notify.NewDispatcher(nil, ssrfGuard, nil)

	alertSvc := service.NewAlertService(alertRepo, projectRepo, endpointRepo, channelRepo, clk, idGen)
	incidentSvc := service.NewIncidentService(incidentRepo, projectRepo, clk, idGen)
	channelSvc := service.NewNotificationService(channelRepo, projectRepo, dispatcher, ssrfGuard, clk, idGen)

	return &alertServicesTestRig{
		alertSvc:     alertSvc,
		incidentSvc:  incidentSvc,
		channelSvc:   channelSvc,
		alertRepo:    alertRepo,
		incidentRepo: incidentRepo,
		channelRepo:  channelRepo,
		endpointRepo: endpointRepo,
		projectRepo:  projectRepo,
		clk:          clk,
	}
}

func TestAlertService_RuleLifecycleAndOptimisticLocking(t *testing.T) {
	rig := setupAlertServicesRig(t)
	ctx := context.Background()

	// 1. Create a notification channel first
	chResp, err := rig.channelSvc.CreateChannel(ctx, "proj-test", domain.CreateChannelRequest{
		Type: domain.ChannelTypeSlack,
		Name: "#slack-alerts",
		Config: domain.JSONMap{
			"webhook_url": "https://hooks.slack.com/services/T1/B1/K1",
		},
	})
	require.NoError(t, err)
	require.NotNil(t, chResp)
	assert.Equal(t, "***", chResp.Config["webhook_url"])

	// 2. Create rule
	ruleResp, err := rig.alertSvc.CreateRule(ctx, "proj-test", domain.CreateAlertRuleRequest{
		Name:        "High Error Rate",
		Description: "Trigger when error rate exceeds 5%",
		Scope: domain.AlertScope{
			Type: domain.AlertScopeProject,
		},
		Condition: domain.AlertCondition{
			Metric:    "error_rate",
			Operator:  ">",
			Threshold: 0.05,
			Window:    "5m",
			For:       "2m",
		},
		Severity:   domain.AlertSeverityCritical,
		ChannelIDs: []string{chResp.ID},
	})
	require.NoError(t, err)
	require.NotNil(t, ruleResp)
	assert.Equal(t, 1, ruleResp.Version)
	assert.Equal(t, domain.AlertStateOK, ruleResp.State)

	// 3. Update rule successfully with version: 1
	newName := "High 5xx Spike"
	upResp, err := rig.alertSvc.UpdateRule(ctx, "proj-test", ruleResp.ID, domain.UpdateAlertRuleRequest{
		Version: 1,
		Name:    &newName,
	})
	require.NoError(t, err)
	assert.Equal(t, 2, upResp.Version)
	assert.Equal(t, "High 5xx Spike", upResp.Name)

	// 4. Update with stale version 1 -> Must return VersionConflict 409
	_, errConflict := rig.alertSvc.UpdateRule(ctx, "proj-test", ruleResp.ID, domain.UpdateAlertRuleRequest{
		Version: 1,
		Name:    &newName,
	})
	assert.Error(t, errConflict)
	appErr, ok := errConflict.(*domain.AppError)
	require.True(t, ok)
	assert.Equal(t, domain.ErrCodeVersionConflict, appErr.ErrorCode)

	// 5. Mute rule for 60 minutes
	muted, err := rig.alertSvc.MuteRule(ctx, "proj-test", ruleResp.ID, 60)
	require.NoError(t, err)
	assert.Equal(t, domain.AlertStateMuted, muted.State)
	assert.NotNil(t, muted.MutedUntil)

	// 6. Delete rule
	require.NoError(t, rig.alertSvc.DeleteRule(ctx, "proj-test", ruleResp.ID))
	_, errNotFound := rig.alertSvc.GetRule(ctx, "proj-test", ruleResp.ID)
	assert.Error(t, errNotFound)
}

func TestAlertService_EndpointScopedRule(t *testing.T) {
	rig := setupAlertServicesRig(t)
	ctx := context.Background()

	// Seed endpoint
	ep, _, err := rig.endpointRepo.UpsertRoute(ctx, "proj-test", discovery.DiscoveredRoute{
		Method:       "POST",
		PathTemplate: "/orders",
		Service:      "order-svc",
	}, domain.SourceOpenAPI, nil)
	require.NoError(t, err)

	// Create endpoint-scoped rule
	ruleResp, err := rig.alertSvc.CreateRule(ctx, "proj-test", domain.CreateAlertRuleRequest{
		Name: "Order Latency Alert",
		Scope: domain.AlertScope{
			Type:       domain.AlertScopeEndpoint,
			EndpointID: &ep.ID,
		},
		Condition: domain.AlertCondition{
			Metric:    "latency_p95",
			Operator:  ">=",
			Threshold: 200,
			Window:    "1m",
			For:       "0m",
		},
		Severity: domain.AlertSeverityWarning,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.AlertScopeEndpoint, ruleResp.Scope.Type)
	assert.Equal(t, ep.ID, *ruleResp.Scope.EndpointID)
}

func TestIncidentService_AcknowledgeResolveComments(t *testing.T) {
	rig := setupAlertServicesRig(t)
	ctx := context.Background()
	now := rig.clk.Now()

	inc := &domain.Incident{
		ID:             "inc-svc-1",
		OrgID:          "org-test",
		ProjectID:      "proj-test",
		RuleID:         "rule-1",
		Status:         domain.IncidentStatusOpen,
		Severity:       domain.AlertSeverityCritical,
		Title:          "Database Connection Saturation",
		Summary:        "Connection pool depleted",
		CurrentValue:   95.0,
		ThresholdValue: 80.0,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, rig.incidentRepo.Create(ctx, inc))

	// 1. Acknowledge
	ackResp, err := rig.incidentSvc.AcknowledgeIncident(ctx, "proj-test", "inc-svc-1", "alice@strimlabs.dev")
	require.NoError(t, err)
	assert.Equal(t, domain.IncidentStatusAcknowledged, ackResp.Status)
	assert.Equal(t, "alice@strimlabs.dev", *ackResp.AcknowledgedBy)

	// 2. Add comment
	commentItem, err := rig.incidentSvc.AddComment(ctx, "proj-test", "inc-svc-1", "alice@strimlabs.dev", domain.AddIncidentCommentRequest{
		Body: "Restarting pool connection instances",
	})
	require.NoError(t, err)
	assert.Equal(t, "Restarting pool connection instances", commentItem.Detail)

	// 3. Resolve
	resResp, err := rig.incidentSvc.ResolveIncident(ctx, "proj-test", "inc-svc-1", "alice@strimlabs.dev")
	require.NoError(t, err)
	assert.Equal(t, domain.IncidentStatusResolved, resResp.Status)
	assert.False(t, resResp.AutoResolved)

	// Verify timeline length
	detail, err := rig.incidentSvc.GetIncident(ctx, "proj-test", "inc-svc-1")
	require.NoError(t, err)
	require.Len(t, detail.Timeline, 3) // Acknowledged + Comment + Resolved
}

func TestNotificationService_SSRFProtection(t *testing.T) {
	rig := setupAlertServicesRig(t)
	ctx := context.Background()

	// 1. Loopback webhook URL blocked at channel creation!
	_, err := rig.channelSvc.CreateChannel(ctx, "proj-test", domain.CreateChannelRequest{
		Type: domain.ChannelTypeWebhook,
		Name: "Internal Attacker Hook",
		Config: domain.JSONMap{
			"url": "http://127.0.0.1:8080/admin",
		},
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "SSRF guard")

	// 2. Valid external webhook succeeds
	chResp, err := rig.channelSvc.CreateChannel(ctx, "proj-test", domain.CreateChannelRequest{
		Type: domain.ChannelTypeWebhook,
		Name: "Valid Partner Hook",
		Config: domain.JSONMap{
			"url":    "https://api.webhook.com/alerts",
			"secret": "top-secret-signing-key",
		},
	})
	require.NoError(t, err)
	assert.Equal(t, "***", chResp.Config["secret"])
}
