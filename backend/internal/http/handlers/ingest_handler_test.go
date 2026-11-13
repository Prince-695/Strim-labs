package handlers_test

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	apphttp "github.com/Prince-695/strim/backend/internal/http"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/Prince-695/strim/backend/internal/sse"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type ingestTestRig struct {
	app         *fiber.App
	projectRepo *repository.InMemoryProjectRepository
	store       *ingest.InMemoryTimeSeriesStore
	batcher     *ingest.Batcher
	clk         *clock.MockClock
	projectID   string
}

func setupIngestTestRig(t *testing.T, batcherCfg ingest.BatcherConfig) *ingestTestRig {
	cfg := &config.Config{
		AppEnv:     "test",
		ServerPort: "8080",
		JWTSecret:  "test-jwt-secret-min-32-chars-long!",
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	idGen := ids.NewUUIDv7Generator()
	fixedTime := time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC)
	clk := clock.NewMockClock(fixedTime)
	tokenCache := cache.NewMemoryCache()
	tenantCache := cache.NewTenantCache(tokenCache)
	projectCache := cache.NewProjectCache(tokenCache)
	ssrfGuard := netguard.NewSSRFGuard(nil)

	sysRepo := repository.NewSystemRepository(nil)
	userRepo := repository.NewInMemoryUserRepository()
	otpRepo := repository.NewInMemoryOTPRepository()
	mockMailer := mailer.NewConsoleMailer(logger)
	memberRepo := repository.NewInMemoryMemberRepository(userRepo)
	orgRepo := repository.NewInMemoryOrgRepository(memberRepo)
	projectRepo := repository.NewInMemoryProjectRepository()
	verificationRepo := repository.NewInMemoryVerificationRepository(projectRepo)
	endpointRepo := repository.NewInMemoryEndpointRepository()

	sysSvc := service.NewSystemService(sysRepo, logger)
	authSvc := service.NewAuthService(cfg, userRepo, otpRepo, mockMailer, tokenCache, clk, idGen, logger)
	userSvc := service.NewUserService(userRepo)
	orgSvc := service.NewOrgService(orgRepo, memberRepo, userRepo, tenantCache)
	verifEngine := service.NewVerificationEngine(nil, nil)
	projectSvc := service.NewProjectService(projectRepo, verificationRepo, projectCache, ssrfGuard, verifEngine)
	endpointSvc := service.NewEndpointService(endpointRepo, projectRepo)
	openapiParser := discovery.NewOpenAPIParser(ssrfGuard)
	discoverySvc := service.NewDiscoveryService(endpointRepo, projectRepo, openapiParser)

	sysHandler := handlers.NewSystemHandler(sysSvc)
	authHandler := handlers.NewAuthHandler(authSvc, cfg)
	userHandler := handlers.NewUserHandler(userSvc)
	orgHandler := handlers.NewOrgHandler(orgSvc)
	memberHandler := handlers.NewMemberHandler(orgSvc)
	projectHandler := handlers.NewProjectHandler(projectSvc)
	endpointHandler := handlers.NewEndpointHandler(endpointSvc)
	discoveryHandler := handlers.NewDiscoveryHandler(discoverySvc)

	// Create a test project
	projID := "proj-ingest-test"
	project := &domain.Project{
		ID:        projID,
		OrgID:     "org-test-1",
		Name:      "Telemetry App",
		Slug:      "telemetry-app",
		BaseURL:   "https://api.example.com",
		CreatedAt: fixedTime,
		UpdatedAt: fixedTime,
	}
	err := projectRepo.CreateWithLimitCheck(context.Background(), project)
	require.NoError(t, err)

	store := ingest.NewInMemoryTimeSeriesStore()
	if batcherCfg.Capacity == 0 {
		batcherCfg.Capacity = 1000
		batcherCfg.BatchSize = 10
		batcherCfg.FlushInterval = 50 * time.Millisecond
		batcherCfg.BackpressureThreshold = 0.95
	}

	batcher := ingest.NewBatcher(batcherCfg, store, endpointRepo, logger)
	batcher.Start()
	t.Cleanup(func() {
		batcher.Stop()
	})

	ingestHandler := handlers.NewIngestHandler(batcher, projectRepo, clk)
	metricsSvc := service.NewMetricsService(store, endpointRepo, projectRepo, nil, clk)
	sseHub := sse.NewHub()
	metricsHandler := handlers.NewMetricsHandler(metricsSvc, sseHub, logger)

	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	jobRepo := repository.NewInMemoryJobRepository()
	capRepo := repository.NewInMemoryCapacityRepository()
	loadTestSvc := service.NewLoadTestService(loadTestRepo, projectRepo, jobRepo, nil, ssrfGuard, cfg.JWTSecret, clk)
	loadTestHandler := handlers.NewLoadTestHandler(loadTestSvc, sseHub, logger)
	capacitySvc := service.NewCapacityService(capRepo, loadTestRepo)
	capacityHandler := handlers.NewCapacityHandler(capacitySvc, logger)

	container := handlers.NewContainer(
		sysHandler,
		authHandler,
		userHandler,
		orgHandler,
		memberHandler,
		projectHandler,
		endpointHandler,
		discoveryHandler,
		ingestHandler,
		metricsHandler,
		loadTestHandler,
		capacityHandler,
	)

	app := apphttp.NewRouter(cfg, container, logger, idGen)

	return &ingestTestRig{
		app:         app,
		projectRepo: projectRepo,
		store:       store,
		batcher:     batcher,
		clk:         clk,
		projectID:   projID,
	}
}

func TestIngestEvents_Success(t *testing.T) {
	rig := setupIngestTestRig(t, ingest.BatcherConfig{})

	payload := domain.IngestEventsRequest{
		Service: "orders-svc",
		Events: []domain.IngestEventItem{
			{
				Method:     "GET",
				Path:       "/orders/123",
				Status:     200,
				DurationMs: 45.2,
				Bytes:      1024,
			},
			{
				Method:     "POST",
				Path:       "/orders",
				Route:      "/orders",
				Status:     201,
				DurationMs: 82.0,
				Bytes:      2048,
			},
		},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", rig.projectID)

	resp, err := rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, resp.StatusCode)

	respBody, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(respBody, &res)
	assert.True(t, res.Success)

	dataMap, ok := res.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, float64(2), dataMap["accepted"])
	assert.Equal(t, float64(0), dataMap["rejected"])

	// Verify events were flushed to time-series storage
	assert.Eventually(t, func() bool {
		events, _ := rig.store.QueryEvents(context.Background(), rig.projectID, time.Time{}, time.Time{}, 10)
		return len(events) == 2
	}, 2*time.Second, 20*time.Millisecond)

	events, err := rig.store.QueryEvents(context.Background(), rig.projectID, time.Time{}, time.Time{}, 10)
	require.NoError(t, err)
	assert.Equal(t, 2, len(events))
	// Verify normalized route template on GET /orders/123
	var getEvent *domain.RequestEvent
	for i := range events {
		if events[i].Method == "GET" {
			getEvent = &events[i]
		}
	}
	require.NotNil(t, getEvent)
	assert.Equal(t, "/orders/{id}", getEvent.Route)
	assert.Equal(t, "orders-svc", getEvent.Service)
}

func TestIngestEvents_Gzip(t *testing.T) {
	rig := setupIngestTestRig(t, ingest.BatcherConfig{})

	payload := domain.IngestEventsRequest{
		Service: "auth-svc",
		Events: []domain.IngestEventItem{
			{
				Method:     "POST",
				Path:       "/auth/login",
				Status:     200,
				DurationMs: 120.0,
			},
		},
	}
	body, _ := json.Marshal(payload)

	var gzBuf bytes.Buffer
	gzWriter := gzip.NewWriter(&gzBuf)
	_, err := gzWriter.Write(body)
	require.NoError(t, err)
	require.NoError(t, gzWriter.Close())

	req := httptest.NewRequest("POST", "/v1/ingest/events", &gzBuf)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	req.Header.Set("X-Project-ID", rig.projectID)

	resp, err := rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, resp.StatusCode)

	respBody, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(respBody, &res)
	assert.True(t, res.Success)
}

func TestIngestEvents_Authentication(t *testing.T) {
	rig := setupIngestTestRig(t, ingest.BatcherConfig{})

	payload := domain.IngestEventsRequest{
		Events: []domain.IngestEventItem{
			{Method: "GET", Path: "/ping", Status: 200, DurationMs: 5},
		},
	}
	body, _ := json.Marshal(payload)

	// 1. Missing authentication
	req := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	// 2. Non-existent project
	req = httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "non-existent-proj-uuid")
	resp, err = rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)

	// 3. Bearer Token Auth
	req = httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+rig.projectID)
	resp, err = rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, resp.StatusCode)
}

func TestIngestEvents_ValidationErrors(t *testing.T) {
	rig := setupIngestTestRig(t, ingest.BatcherConfig{})

	payload := domain.IngestEventsRequest{
		Events: []domain.IngestEventItem{
			{
				Method:     "VALID_METHOD", // invalid
				Path:       "/ok",
				Status:     200,
				DurationMs: 10,
			},
			{
				Method:     "GET",
				Path:       "", // empty path
				Status:     200,
				DurationMs: 10,
			},
			{
				Method:     "GET",
				Path:       "/status-invalid",
				Status:     999, // invalid status
				DurationMs: 10,
			},
			{
				Method:     "GET",
				Path:       "/neg-duration",
				Status:     200,
				DurationMs: -5.0, // negative duration
			},
			{
				Method:     "GET",
				Path:       "/valid-one",
				Status:     200,
				DurationMs: 12.0,
			},
		},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", rig.projectID)

	resp, err := rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, resp.StatusCode)

	respBody, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(respBody, &res)
	assert.True(t, res.Success)

	dataMap := res.Data.(map[string]interface{})
	assert.Equal(t, float64(1), dataMap["accepted"])
	assert.Equal(t, float64(4), dataMap["rejected"])

	errorsList, ok := dataMap["errors"].([]interface{})
	require.True(t, ok)
	assert.Equal(t, 4, len(errorsList))
}

func TestIngestEvents_ClockSkew(t *testing.T) {
	rig := setupIngestTestRig(t, ingest.BatcherConfig{})

	fixedNow := rig.clk.Now()
	tooOld := fixedNow.Add(-25 * time.Hour)       // older than 24 hours
	tooFarFuture := fixedNow.Add(6 * time.Minute) // > 5 min future

	payload := domain.IngestEventsRequest{
		Events: []domain.IngestEventItem{
			{
				TS:         &tooOld,
				Method:     "GET",
				Path:       "/old",
				Status:     200,
				DurationMs: 10,
			},
			{
				TS:         &tooFarFuture,
				Method:     "GET",
				Path:       "/future",
				Status:     200,
				DurationMs: 10,
			},
		},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", rig.projectID)

	resp, err := rig.app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusAccepted, resp.StatusCode)

	var res domain.Response
	_ = json.NewDecoder(resp.Body).Decode(&res)
	dataMap := res.Data.(map[string]interface{})
	assert.Equal(t, float64(0), dataMap["accepted"])
	assert.Equal(t, float64(2), dataMap["rejected"])
}

func TestIngestEvents_PayloadLimits(t *testing.T) {
	rig := setupIngestTestRig(t, ingest.BatcherConfig{})

	// 1. Empty events array
	emptyPayload := domain.IngestEventsRequest{Events: []domain.IngestEventItem{}}
	b, _ := json.Marshal(emptyPayload)
	req := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", rig.projectID)
	resp, _ := rig.app.Test(req, 5000)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	// 2. > 1000 events
	tooMany := domain.IngestEventsRequest{
		Events: make([]domain.IngestEventItem, 1001),
	}
	for i := 0; i < 1001; i++ {
		tooMany.Events[i] = domain.IngestEventItem{
			Method: "GET", Path: "/ping", Status: 200, DurationMs: 1,
		}
	}
	bTooMany, _ := json.Marshal(tooMany)
	req = httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(bTooMany))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", rig.projectID)
	resp, _ = rig.app.Test(req, 5000)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	// 3. Compressed body > 1 MB
	oversizedCompressed := make([]byte, 1024*1024+10)
	req = httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(oversizedCompressed))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	req.Header.Set("X-API-Key", rig.projectID)
	resp, _ = rig.app.Test(req, 5000)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

type blockingStore struct {
	*ingest.InMemoryTimeSeriesStore
	block chan struct{}
}

func (s *blockingStore) WriteEvents(ctx context.Context, events []domain.RequestEvent) error {
	<-s.block
	return s.InMemoryTimeSeriesStore.WriteEvents(ctx, events)
}

func TestIngestEvents_Backpressure(t *testing.T) {
	blockCh := make(chan struct{})
	defer close(blockCh)

	slowStore := &blockingStore{
		InMemoryTimeSeriesStore: ingest.NewInMemoryTimeSeriesStore(),
		block:                   blockCh,
	}

	cfg := &config.Config{
		AppEnv:     "test",
		ServerPort: "8080",
		JWTSecret:  "test-jwt-secret-min-32-chars-long!",
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	idGen := ids.NewUUIDv7Generator()
	fixedTime := time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC)
	clk := clock.NewMockClock(fixedTime)
	tokenCache := cache.NewMemoryCache()
	tenantCache := cache.NewTenantCache(tokenCache)
	projectCache := cache.NewProjectCache(tokenCache)
	ssrfGuard := netguard.NewSSRFGuard(nil)

	sysRepo := repository.NewSystemRepository(nil)
	userRepo := repository.NewInMemoryUserRepository()
	otpRepo := repository.NewInMemoryOTPRepository()
	mockMailer := mailer.NewConsoleMailer(logger)
	memberRepo := repository.NewInMemoryMemberRepository(userRepo)
	orgRepo := repository.NewInMemoryOrgRepository(memberRepo)
	projectRepo := repository.NewInMemoryProjectRepository()
	verificationRepo := repository.NewInMemoryVerificationRepository(projectRepo)
	endpointRepo := repository.NewInMemoryEndpointRepository()

	sysSvc := service.NewSystemService(sysRepo, logger)
	authSvc := service.NewAuthService(cfg, userRepo, otpRepo, mockMailer, tokenCache, clk, idGen, logger)
	userSvc := service.NewUserService(userRepo)
	orgSvc := service.NewOrgService(orgRepo, memberRepo, userRepo, tenantCache)
	verifEngine := service.NewVerificationEngine(nil, nil)
	projectSvc := service.NewProjectService(projectRepo, verificationRepo, projectCache, ssrfGuard, verifEngine)
	endpointSvc := service.NewEndpointService(endpointRepo, projectRepo)
	openapiParser := discovery.NewOpenAPIParser(ssrfGuard)
	discoverySvc := service.NewDiscoveryService(endpointRepo, projectRepo, openapiParser)

	sysHandler := handlers.NewSystemHandler(sysSvc)
	authHandler := handlers.NewAuthHandler(authSvc, cfg)
	userHandler := handlers.NewUserHandler(userSvc)
	orgHandler := handlers.NewOrgHandler(orgSvc)
	memberHandler := handlers.NewMemberHandler(orgSvc)
	projectHandler := handlers.NewProjectHandler(projectSvc)
	endpointHandler := handlers.NewEndpointHandler(endpointSvc)
	discoveryHandler := handlers.NewDiscoveryHandler(discoverySvc)

	projID := "proj-bp-test"
	_ = projectRepo.CreateWithLimitCheck(context.Background(), &domain.Project{
		ID:        projID,
		OrgID:     "org-test-1",
		Name:      "BP Test",
		Slug:      "bp-test",
		BaseURL:   "https://api.example.com",
		CreatedAt: fixedTime,
		UpdatedAt: fixedTime,
	})

	batcher := ingest.NewBatcher(ingest.BatcherConfig{
		Capacity:              5,
		BatchSize:             1,
		FlushInterval:         10 * time.Minute,
		BackpressureThreshold: 0.6, // saturated at >= 3 items in channel
	}, slowStore, endpointRepo, logger)
	batcher.Start()
	t.Cleanup(func() {
		batcher.Stop()
	})

	// Enqueue 1 item to trigger worker flush, which blocks on slowStore
	_ = batcher.Enqueue(domain.RequestEvent{ProjectID: projID, Method: "GET", Route: "/block"})
	time.Sleep(20 * time.Millisecond) // ensure worker picks it up and blocks

	// Now fill channel with 4 items (4 / 5 = 80% > 60%)
	for i := 0; i < 4; i++ {
		_ = batcher.Enqueue(domain.RequestEvent{ProjectID: projID, Method: "GET", Route: "/fill"})
	}

	ingestHandler := handlers.NewIngestHandler(batcher, projectRepo, clk)
	metricsSvc := service.NewMetricsService(slowStore, endpointRepo, projectRepo, nil, clk)
	sseHub := sse.NewHub()
	metricsHandler := handlers.NewMetricsHandler(metricsSvc, sseHub, logger)

	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	jobRepo := repository.NewInMemoryJobRepository()
	capRepo := repository.NewInMemoryCapacityRepository()
	loadTestSvc := service.NewLoadTestService(loadTestRepo, projectRepo, jobRepo, nil, ssrfGuard, cfg.JWTSecret, clk)
	loadTestHandler := handlers.NewLoadTestHandler(loadTestSvc, sseHub, logger)
	capacitySvc := service.NewCapacityService(capRepo, loadTestRepo)
	capacityHandler := handlers.NewCapacityHandler(capacitySvc, logger)

	container := handlers.NewContainer(
		sysHandler, authHandler, userHandler, orgHandler, memberHandler,
		projectHandler, endpointHandler, discoveryHandler, ingestHandler,
		metricsHandler, loadTestHandler, capacityHandler,
	)
	app := apphttp.NewRouter(cfg, container, logger, idGen)

	payload := domain.IngestEventsRequest{
		Events: []domain.IngestEventItem{
			{Method: "GET", Path: "/bp", Status: 200, DurationMs: 10},
		},
	}
	b, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/v1/ingest/events", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", projID)

	resp, err := app.Test(req, 5000)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusTooManyRequests, resp.StatusCode)

	// Verify Retry-After: 2 header
	assert.Equal(t, "2", resp.Header.Get("Retry-After"))

	respBody, _ := io.ReadAll(resp.Body)
	var res domain.Response
	_ = json.Unmarshal(respBody, &res)
	assert.False(t, res.Success)
	assert.Equal(t, domain.ErrCodeIngestBackpressure, res.ErrorCode)
}
