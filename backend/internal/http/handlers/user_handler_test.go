package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	apphttp "github.com/Prince-695/strim/backend/internal/http"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/crypto"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockIPResolver struct {
	ips map[string][]net.IP
}

func (m *mockIPResolver) LookupIP(ctx context.Context, network, host string) ([]net.IP, error) {
	if ips, ok := m.ips[host]; ok {
		return ips, nil
	}
	return nil, &net.DNSError{Err: "no such host", Name: host}
}

type testRig struct {
	app          *fiber.App
	cfg          *config.Config
	userRepo     repository.UserRepository
	orgRepo      repository.OrgRepository
	memberRepo   repository.MemberRepository
	projectRepo  repository.ProjectRepository
	verifRepo    repository.VerificationRepository
	endpointRepo repository.EndpointRepository
	orgSvc       service.OrgService
	userSvc      service.UserService
	authSvc      service.AuthService
	projectSvc   service.ProjectService
	endpointSvc  service.EndpointService
	discoverySvc service.DiscoveryService
}

func newTestRig(t *testing.T) *testRig {
	cfg := &config.Config{
		AppEnv:             "test",
		ServerPort:         "8080",
		APIBaseURL:         "http://localhost:8080",
		WebOrigin:          "http://localhost:3000",
		AllowedOrigins:     []string{"http://localhost:3000"},
		LogLevel:           "error",
		RequestTimeout:     5 * time.Second,
		BodyLimitBytes:     2 * 1024 * 1024,
		SwaggerUser:        "admin",
		SwaggerPassword:    "secretpassword",
		JWTSecret:          "strim-labs-test-secret-32-chars-long!",
		AccessTokenExpiry:  15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	idGen := ids.NewUUIDv7Generator()
	clk := clock.NewRealClock()
	memCache := cache.NewMemoryCache()
	tenantCache := cache.NewTenantCache(memCache)

	userRepo := repository.NewInMemoryUserRepository()
	otpRepo := repository.NewInMemoryOTPRepository()
	memberRepo := repository.NewInMemoryMemberRepository(userRepo)
	orgRepo := repository.NewInMemoryOrgRepository(memberRepo)
	mockMailer := mailer.NewMockMailer()

	sysRepo := &mockSystemRepo{}
	sysSvc := service.NewSystemService(sysRepo, logger)
	authSvc := service.NewAuthService(cfg, userRepo, otpRepo, mockMailer, memCache, clk, idGen, logger)
	userSvc := service.NewUserService(userRepo)
	orgSvc := service.NewOrgService(orgRepo, memberRepo, userRepo, tenantCache)

	sysHandler := handlers.NewSystemHandler(sysSvc)
	authHandler := handlers.NewAuthHandler(authSvc, cfg)
	userHandler := handlers.NewUserHandler(userSvc)
	orgHandler := handlers.NewOrgHandler(orgSvc)
	memberHandler := handlers.NewMemberHandler(orgSvc)

	projectRepo := repository.NewInMemoryProjectRepository()
	verificationRepo := repository.NewInMemoryVerificationRepository(projectRepo)
	projectCache := cache.NewProjectCache(memCache)
	mockRes := &mockIPResolver{
		ips: map[string][]net.IP{
			"api.acme.com":      {net.ParseIP("93.184.216.34")},
			"api-v2.acme.com":   {net.ParseIP("93.184.216.35")},
			"internal.acme.com": {net.ParseIP("10.0.0.1")},
		},
	}
	ssrfGuard := netguard.NewSSRFGuard(mockRes)
	verifEngine := service.NewVerificationEngine(nil, nil)
	projectSvc := service.NewProjectService(projectRepo, verificationRepo, projectCache, ssrfGuard, verifEngine)
	projectHandler := handlers.NewProjectHandler(projectSvc)

	endpointRepo := repository.NewInMemoryEndpointRepository()
	endpointSvc := service.NewEndpointService(endpointRepo, projectRepo)
	openapiParser := discovery.NewOpenAPIParser(ssrfGuard)
	discoverySvc := service.NewDiscoveryService(endpointRepo, projectRepo, openapiParser)
	endpointHandler := handlers.NewEndpointHandler(endpointSvc)
	discoveryHandler := handlers.NewDiscoveryHandler(discoverySvc)

	container := handlers.NewContainer(
		sysHandler,
		authHandler,
		userHandler,
		orgHandler,
		memberHandler,
		projectHandler,
		endpointHandler,
		discoveryHandler,
	)
	app := apphttp.NewRouter(cfg, container, logger, idGen)

	return &testRig{
		app:          app,
		cfg:          cfg,
		userRepo:     userRepo,
		orgRepo:      orgRepo,
		memberRepo:   memberRepo,
		projectRepo:  projectRepo,
		verifRepo:    verificationRepo,
		endpointRepo: endpointRepo,
		orgSvc:       orgSvc,
		userSvc:      userSvc,
		authSvc:      authSvc,
		projectSvc:   projectSvc,
		endpointSvc:  endpointSvc,
		discoverySvc: discoverySvc,
	}
}

type mockSystemRepo struct {
	err error
}

func (m *mockSystemRepo) Ping(ctx context.Context) error {
	return m.err
}

func (r *testRig) createAuthToken(t *testing.T, userID, email string, isVerified bool) string {
	token, _, err := crypto.GenerateAccessToken(userID, "session-1", email, isVerified, 15*time.Minute, r.cfg.JWTSecret)
	require.NoError(t, err)
	return token
}

func TestUserHandler_CheckUsername(t *testing.T) {
	rig := newTestRig(t)

	req := httptest.NewRequest("GET", "/v1/users/username?u=dev_hero", nil)
	resp, err := rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var res domain.Response
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&res))
	assert.True(t, res.Success)
}

func TestUserHandler_Me_And_Update(t *testing.T) {
	rig := newTestRig(t)
	ctx := context.Background()

	user := &domain.User{
		ID:         "test-user-me",
		Email:      "me@example.com",
		FirstName:  "Initial",
		LastName:   "Name",
		IsVerified: true,
	}
	require.NoError(t, rig.userRepo.Create(ctx, user))
	token := rig.createAuthToken(t, user.ID, user.Email, true)

	// 1. GET /v1/users/me
	req := httptest.NewRequest("GET", "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := rig.app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	// 2. POST /v1/users/username
	bodyBytes, _ := json.Marshal(domain.SetUsernameRequest{Username: "initialname"})
	reqClaim := httptest.NewRequest("POST", "/v1/users/username", bytes.NewReader(bodyBytes))
	reqClaim.Header.Set("Authorization", "Bearer "+token)
	reqClaim.Header.Set("Content-Type", "application/json")
	respClaim, err := rig.app.Test(reqClaim)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respClaim.StatusCode)

	// 3. PUT /v1/users/update
	updateBytes, _ := json.Marshal(domain.UpdateUserRequest{FirstName: "Updated", LastName: "User"})
	reqUpdate := httptest.NewRequest("PUT", "/v1/users/update", bytes.NewReader(updateBytes))
	reqUpdate.Header.Set("Authorization", "Bearer "+token)
	reqUpdate.Header.Set("Content-Type", "application/json")
	respUpdate, err := rig.app.Test(reqUpdate)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respUpdate.StatusCode)
}
