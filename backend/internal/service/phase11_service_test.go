package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/events"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPhase11ServiceTest(t *testing.T) (*APIKeyService, *WebhookService, *AuditService, *UsageService, *repository.InMemoryProjectRepository, *repository.InMemoryOrgRepository) {
	keyRepo := repository.NewInMemoryAPIKeyRepository()
	webhookRepo := repository.NewInMemoryWebhookRepository()
	deliveryRepo := repository.NewInMemoryWebhookDeliveryRepository()
	auditRepo := repository.NewInMemoryAuditLogRepository()
	usageRepo := repository.NewInMemoryUsageRepository()
	projectRepo := repository.NewInMemoryProjectRepository()
	userRepo := repository.NewInMemoryUserRepository()
	memberRepo := repository.NewInMemoryMemberRepository(userRepo)
	orgRepo := repository.NewInMemoryOrgRepository(memberRepo)

	auditRec := audit.NewAsyncRecorder(auditRepo)
	dispatcher := events.NewWebhookDispatcher(webhookRepo, deliveryRepo, nil, http.DefaultClient)

	apiKeySvc := NewAPIKeyService(keyRepo, projectRepo, auditRec)
	webhookSvc := NewWebhookService(webhookRepo, deliveryRepo, projectRepo, nil, dispatcher, auditRec)
	auditSvc := NewAuditService(auditRepo, orgRepo)
	usageSvc := NewUsageService(usageRepo, projectRepo, orgRepo)

	// Seed test org & project
	ctx := context.Background()
	_ = orgRepo.CreateWithLimitCheck(ctx, &domain.Organization{
		ID:   "org-1",
		Name: "Test Org",
		Slug: "test-org",
	}, "user-1")
	_ = projectRepo.CreateWithLimitCheck(ctx, &domain.Project{
		ID:      "proj-1",
		OrgID:   "org-1",
		Name:    "Test Project",
		Slug:    "test-project",
		BaseURL: "https://api.example.com",
	})

	return apiKeySvc, webhookSvc, auditSvc, usageSvc, projectRepo, orgRepo
}

func TestAPIKeyService_Lifecycle(t *testing.T) {
	ctx := context.Background()
	apiKeySvc, _, _, _, _, _ := setupPhase11ServiceTest(t)

	// 1. Create Key
	createResp, err := apiKeySvc.CreateKey(ctx, "org-1", "proj-1", &domain.CreateAPIKeyRequest{
		Name:   "Production Ingestion Key",
		Scopes: []string{string(domain.ScopeIngest), string(domain.ScopeDiscovery)},
	})
	require.NoError(t, err)
	assert.NotEmpty(t, createResp.ID)
	assert.NotEmpty(t, createResp.Secret)
	assert.Contains(t, createResp.Message, "Copy this key now")

	rawSecret := createResp.Secret

	// 2. Validate Key
	validated, err := apiKeySvc.ValidateKey(ctx, rawSecret, domain.ScopeIngest)
	require.NoError(t, err)
	assert.Equal(t, createResp.ID, validated.ID)

	// 3. Validate Scope missing
	_, err = apiKeySvc.ValidateKey(ctx, rawSecret, domain.ScopeRead)
	assert.Error(t, err)

	// 4. List Keys
	list, err := apiKeySvc.ListKeys(ctx, "org-1", "proj-1")
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Empty(t, list[0].Secret) // Secret must not be returned in list

	// 5. Rotate Key
	graceHours := 12
	rotateResp, err := apiKeySvc.RotateKey(ctx, "org-1", "proj-1", createResp.ID, &domain.RotateAPIKeyRequest{
		GraceHours: &graceHours,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, rotateResp.Secret)
	assert.NotEqual(t, rawSecret, rotateResp.Secret)

	// Old key should still be valid during grace period
	_, err = apiKeySvc.ValidateKey(ctx, rawSecret, domain.ScopeIngest)
	assert.NoError(t, err)

	// New key should also be valid
	_, err = apiKeySvc.ValidateKey(ctx, rotateResp.Secret, domain.ScopeIngest)
	assert.NoError(t, err)

	// 6. Revoke New Key
	err = apiKeySvc.RevokeKey(ctx, "org-1", "proj-1", rotateResp.ID)
	require.NoError(t, err)

	// Revoked key fails validation
	_, err = apiKeySvc.ValidateKey(ctx, rotateResp.Secret, domain.ScopeIngest)
	assert.Error(t, err)
}

func TestWebhookService_Lifecycle(t *testing.T) {
	ctx := context.Background()
	_, webhookSvc, _, _, _, _ := setupPhase11ServiceTest(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// 1. Create Webhook
	created, err := webhookSvc.CreateWebhook(ctx, "org-1", "proj-1", &domain.CreateWebhookRequest{
		URL:    "https://api.github.com/webhook",
		Events: []string{string(domain.EventTestCompleted), string(domain.EventIncidentOpened)},
	})
	require.NoError(t, err)
	assert.NotEmpty(t, created.ID)
	assert.Equal(t, "***", created.Secret)

	// 2. List Webhooks
	list, err := webhookSvc.ListWebhooks(ctx, "org-1", "proj-1")
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "***", list[0].Secret)

	// 3. Update Webhook
	newURL := "https://api.github.com/v2/webhook"
	updated, err := webhookSvc.UpdateWebhook(ctx, "org-1", "proj-1", created.ID, &domain.UpdateWebhookRequest{
		URL: &newURL,
	})
	require.NoError(t, err)
	assert.Equal(t, newURL, updated.URL)

	// 4. Delete Webhook
	err = webhookSvc.DeleteWebhook(ctx, "org-1", "proj-1", created.ID)
	require.NoError(t, err)

	listAfter, err := webhookSvc.ListWebhooks(ctx, "org-1", "proj-1")
	require.NoError(t, err)
	assert.Empty(t, listAfter)
}

func TestAuditService_ListLogs(t *testing.T) {
	ctx := context.Background()
	apiKeySvc, _, auditSvc, _, _, _ := setupPhase11ServiceTest(t)

	// Trigger an audited action (API key creation)
	ctx = audit.WithAuditContext(ctx, "user-lead", "lead@strimlabs.dev", "192.168.1.1", "curl/8.0")
	_, err := apiKeySvc.CreateKey(ctx, "org-1", "proj-1", &domain.CreateAPIKeyRequest{
		Name:   "Audit Test Key",
		Scopes: []string{string(domain.ScopeIngest)},
	})
	require.NoError(t, err)

	// Query audit logs
	logs, err := auditSvc.ListAuditLogs(ctx, "org-1", domain.AuditLogFilter{
		Limit: 10,
	})
	require.NoError(t, err)
	require.NotEmpty(t, logs)
	assert.Equal(t, "api_key.created", logs[0].Action)
	assert.Equal(t, "lead@strimlabs.dev", logs[0].Actor.Email)
}

func TestUsageService_QuotasAndReport(t *testing.T) {
	ctx := context.Background()
	_, _, _, usageSvc, _, _ := setupPhase11ServiceTest(t)

	// Record usage
	err := usageSvc.RecordIngestedEvents(ctx, "org-1", 50000)
	require.NoError(t, err)

	err = usageSvc.RecordLoadTestRun(ctx, "org-1", 15, 25000)
	require.NoError(t, err)

	// Get usage report
	resp, err := usageSvc.GetUsage(ctx, "org-1", "current_month", "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(50000), resp.Metrics.EventsIngested.Used)
	assert.Equal(t, int64(15), resp.Metrics.LoadTestMinutes.Used)
	assert.Equal(t, int64(25000), resp.Metrics.RequestsGenerated.Used)
	assert.Equal(t, int64(1), resp.Metrics.Projects.Used) // 1 project seeded
	assert.NotEmpty(t, resp.Daily)

	// Check quota within allowance
	err = usageSvc.CheckEventsQuota(ctx, "org-1", 1000)
	assert.NoError(t, err)

	// Check quota exceeding allowance
	err = usageSvc.CheckEventsQuota(ctx, "org-1", domain.DefaultPlanLimits.EventsIngestedLimit+1)
	assert.Error(t, err)
	var appErr *domain.AppError
	assert.ErrorAs(t, err, &appErr)
	assert.Equal(t, domain.ErrCodePlanLimitExceeded, appErr.ErrorCode)
}
