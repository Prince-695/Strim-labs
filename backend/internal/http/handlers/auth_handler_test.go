package handlers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	apphttp "github.com/Prince-695/strim/backend/internal/http"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
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

type httpTestHarness struct {
	app        *fiber.App
	cfg        *config.Config
	authSvc    service.AuthService
	mockMailer *mailer.MockMailer
}

func newHTTPTestHarness(t *testing.T) *httpTestHarness {
	middleware.ResetRateLimiter()

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
	userRepo := repository.NewInMemoryUserRepository()
	otpRepo := repository.NewInMemoryOTPRepository()
	mockMailer := mailer.NewMockMailer()
	tokenCache := cache.NewMemoryCache()
	clk := clock.NewRealClock()

	sysSvc := service.NewSystemService(nil, logger)
	authSvc := service.NewAuthService(
		cfg,
		userRepo,
		otpRepo,
		mockMailer,
		tokenCache,
		clk,
		idGen,
		logger,
	)

	sysHandler := handlers.NewSystemHandler(sysSvc)
	authHandler := handlers.NewAuthHandler(authSvc, cfg)

	memberRepo := repository.NewInMemoryMemberRepository(userRepo)
	orgRepo := repository.NewInMemoryOrgRepository(memberRepo)
	tenantCache := cache.NewTenantCache(tokenCache)
	userSvc := service.NewUserService(userRepo)
	orgSvc := service.NewOrgService(orgRepo, memberRepo, userRepo, tenantCache)

	userHandler := handlers.NewUserHandler(userSvc)
	orgHandler := handlers.NewOrgHandler(orgSvc)
	memberHandler := handlers.NewMemberHandler(orgSvc)

	projectRepo := repository.NewInMemoryProjectRepository()
	verificationRepo := repository.NewInMemoryVerificationRepository(projectRepo)
	projectCache := cache.NewProjectCache(tokenCache)
	ssrfGuard := netguard.NewSSRFGuard(nil)
	verifEngine := service.NewVerificationEngine(nil, nil)
	projectSvc := service.NewProjectService(projectRepo, verificationRepo, projectCache, ssrfGuard, verifEngine)
	projectHandler := handlers.NewProjectHandler(projectSvc)

	endpointRepo := repository.NewInMemoryEndpointRepository()
	endpointSvc := service.NewEndpointService(endpointRepo, projectRepo)
	openapiParser := discovery.NewOpenAPIParser(ssrfGuard)
	discoverySvc := service.NewDiscoveryService(endpointRepo, projectRepo, openapiParser)
	endpointHandler := handlers.NewEndpointHandler(endpointSvc)
	discoveryHandler := handlers.NewDiscoveryHandler(discoverySvc)
	ingestStore := ingest.NewInMemoryTimeSeriesStore()
	batcher := ingest.NewBatcher(ingest.BatcherConfig{}, ingestStore, endpointRepo, logger)
	batcher.Start()
	ingestHandler := handlers.NewIngestHandler(batcher, projectRepo, clk)
	metricsSvc := service.NewMetricsService(ingestStore, endpointRepo, projectRepo, nil, clk)
	sseHub := sse.NewHub()
	metricsHandler := handlers.NewMetricsHandler(metricsSvc, sseHub, logger)

	loadTestRepo := repository.NewInMemoryLoadTestRepository()
	jobRepo := repository.NewInMemoryJobRepository()
	capRepo := repository.NewInMemoryCapacityRepository()
	loadTestSvc := service.NewLoadTestService(loadTestRepo, projectRepo, jobRepo, nil, ssrfGuard, cfg.JWTSecret, clk)
	loadTestHandler := handlers.NewLoadTestHandler(loadTestSvc, sseHub, logger)
	capacitySvc := service.NewCapacityService(capRepo, loadTestRepo)
	capacityHandler := handlers.NewCapacityHandler(capacitySvc, logger)
	diagnosticsSvc := service.NewDiagnosticsService(ingestStore, endpointRepo, loadTestRepo, projectRepo, clk)
	diagnosticsHandler := handlers.NewDiagnosticsHandler(diagnosticsSvc, logger)

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
		diagnosticsHandler,
	)

	app := apphttp.NewRouter(cfg, container, logger, idGen)

	return &httpTestHarness{
		app:        app,
		cfg:        cfg,
		authSvc:    authSvc,
		mockMailer: mockMailer,
	}
}

func TestAuthHandler_Signup_Success(t *testing.T) {
	h := newHTTPTestHarness(t)

	payload := domain.SignupRequest{
		Email:     "newuser@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Grace",
		LastName:  "Hopper",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.app.Test(req, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	var res domain.Response
	err = json.NewDecoder(resp.Body).Decode(&res)
	require.NoError(t, err)

	assert.True(t, res.Success)
	assert.NotEmpty(t, res.AccessToken)
	assert.NotEmpty(t, res.RequestID)
	assert.NotEmpty(t, res.ResponseTime)

	// Check cookies
	cookies := resp.Cookies()
	var accessCookie, refreshCookie bool
	for _, c := range cookies {
		if c.Name == "access_token" && c.Value != "" {
			accessCookie = true
			assert.True(t, c.HttpOnly)
		}
		if c.Name == "refresh_token" && c.Value != "" {
			refreshCookie = true
			assert.True(t, c.HttpOnly)
		}
	}
	assert.True(t, accessCookie)
	assert.True(t, refreshCookie)
}

func TestAuthHandler_Signup_ValidationFailure(t *testing.T) {
	h := newHTTPTestHarness(t)

	// Invalid payload: invalid email, short password
	payload := domain.SignupRequest{
		Email:     "not-an-email",
		Password:  "short",
		FirstName: "",
		LastName:  "",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.app.Test(req, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	var res domain.Response
	err = json.NewDecoder(resp.Body).Decode(&res)
	require.NoError(t, err)
	assert.False(t, res.Success)
	assert.Equal(t, domain.ErrCodeValidationFailed, res.ErrorCode)
}

func TestAuthHandler_Login_Success_And_Unauthorized(t *testing.T) {
	h := newHTTPTestHarness(t)

	// Register user first
	signupBody, _ := json.Marshal(domain.SignupRequest{
		Email:     "login_test@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Ada",
		LastName:  "Lovelace",
	})
	signupReq := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(signupBody))
	signupReq.Header.Set("Content-Type", "application/json")
	_, err := h.app.Test(signupReq, -1)
	require.NoError(t, err)

	// 1. Wrong password -> 401
	badLoginBody, _ := json.Marshal(domain.LoginRequest{
		Email:    "login_test@strimlabs.dev",
		Password: "IncorrectPassword123!",
	})
	badReq := httptest.NewRequest("POST", "/v1/auth/login", bytes.NewReader(badLoginBody))
	badReq.Header.Set("Content-Type", "application/json")
	badResp, err := h.app.Test(badReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, badResp.StatusCode)

	// 2. Correct password -> 200
	validLoginBody, _ := json.Marshal(domain.LoginRequest{
		Email:    "login_test@strimlabs.dev",
		Password: "Str0ng!P@ssw0rd2026",
	})
	validReq := httptest.NewRequest("POST", "/v1/auth/login", bytes.NewReader(validLoginBody))
	validReq.Header.Set("Content-Type", "application/json")
	validResp, err := h.app.Test(validReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, validResp.StatusCode)

	var res domain.Response
	err = json.NewDecoder(validResp.Body).Decode(&res)
	require.NoError(t, err)
	assert.True(t, res.Success)
	assert.NotEmpty(t, res.AccessToken)
}

func TestAuthHandler_Me_Bearer_And_Cookie(t *testing.T) {
	h := newHTTPTestHarness(t)

	// Register user
	signupBody, _ := json.Marshal(domain.SignupRequest{
		Email:     "profile_test@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Katherine",
		LastName:  "Johnson",
	})
	signupReq := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(signupBody))
	signupReq.Header.Set("Content-Type", "application/json")
	signupResp, err := h.app.Test(signupReq, -1)
	require.NoError(t, err)

	var signupRes domain.Response
	_ = json.NewDecoder(signupResp.Body).Decode(&signupRes)
	token := signupRes.AccessToken
	require.NotEmpty(t, token)

	// 1. Without auth -> 401
	noAuthReq := httptest.NewRequest("GET", "/v1/auth/me", nil)
	noAuthResp, err := h.app.Test(noAuthReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, noAuthResp.StatusCode)

	// 2. With Bearer token -> 200
	bearerReq := httptest.NewRequest("GET", "/v1/auth/me", nil)
	bearerReq.Header.Set("Authorization", "Bearer "+token)
	bearerResp, err := h.app.Test(bearerReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, bearerResp.StatusCode)

	var meRes domain.Response
	_ = json.NewDecoder(bearerResp.Body).Decode(&meRes)
	assert.True(t, meRes.Success)

	// 3. With Cookie token -> 200
	cookieReq := httptest.NewRequest("GET", "/v1/auth/me", nil)
	cookieReq.Header.Set("Cookie", fmt.Sprintf("access_token=%s", token))
	cookieResp, err := h.app.Test(cookieReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, cookieResp.StatusCode)
}

func TestAuthHandler_Refresh_Endpoint(t *testing.T) {
	h := newHTTPTestHarness(t)

	// Register user
	signupBody, _ := json.Marshal(domain.SignupRequest{
		Email:     "refresh_endpoint@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Dorothy",
		LastName:  "Vaughan",
	})
	signupReq := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(signupBody))
	signupReq.Header.Set("Content-Type", "application/json")
	signupResp, err := h.app.Test(signupReq, -1)
	require.NoError(t, err)

	// Extract refresh token from cookies
	var rawRefresh string
	for _, c := range signupResp.Cookies() {
		if c.Name == "refresh_token" {
			rawRefresh = c.Value
		}
	}
	require.NotEmpty(t, rawRefresh)

	// Request token rotation via body
	refreshBody, _ := json.Marshal(domain.RefreshRequest{
		RefreshToken: rawRefresh,
	})
	refreshReq := httptest.NewRequest("POST", "/v1/auth/refresh", bytes.NewReader(refreshBody))
	refreshReq.Header.Set("Content-Type", "application/json")
	refreshResp, err := h.app.Test(refreshReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, refreshResp.StatusCode)

	var refreshRes domain.Response
	_ = json.NewDecoder(refreshResp.Body).Decode(&refreshRes)
	assert.True(t, refreshRes.Success)
	assert.NotEmpty(t, refreshRes.AccessToken)
}

func TestAuthHandler_CSRF_Protection(t *testing.T) {
	h := newHTTPTestHarness(t)

	// Register user
	signupBody, _ := json.Marshal(domain.SignupRequest{
		Email:     "csrf_test@strimlabs.dev",
		Password:  "Str0ng!P@ssw0rd2026",
		FirstName: "Mary",
		LastName:  "Jackson",
	})
	signupReq := httptest.NewRequest("POST", "/v1/auth/signup", bytes.NewReader(signupBody))
	signupReq.Header.Set("Content-Type", "application/json")
	signupResp, err := h.app.Test(signupReq, -1)
	require.NoError(t, err)

	var signupRes domain.Response
	_ = json.NewDecoder(signupResp.Body).Decode(&signupRes)
	token := signupRes.AccessToken

	// 1. Cookie authenticated mutating request WITHOUT Origin header -> 403 Forbidden
	csrfFailReq := httptest.NewRequest("POST", "/v1/auth/logout", nil)
	csrfFailReq.Header.Set("Cookie", fmt.Sprintf("access_token=%s", token))
	csrfFailResp, err := h.app.Test(csrfFailReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusForbidden, csrfFailResp.StatusCode)

	// 2. Cookie authenticated mutating request WITH UNTRUSTED Origin -> 403 Forbidden
	untrustedReq := httptest.NewRequest("POST", "/v1/auth/logout", nil)
	untrustedReq.Header.Set("Cookie", fmt.Sprintf("access_token=%s", token))
	untrustedReq.Header.Set("Origin", "https://malicious-site.com")
	untrustedResp, err := h.app.Test(untrustedReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusForbidden, untrustedResp.StatusCode)

	// 3. Cookie authenticated mutating request WITH TRUSTED Origin -> 200 OK
	validReq := httptest.NewRequest("POST", "/v1/auth/logout", nil)
	validReq.Header.Set("Cookie", fmt.Sprintf("access_token=%s", token))
	validReq.Header.Set("Origin", "http://localhost:3000")
	validResp, err := h.app.Test(validReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, validResp.StatusCode)

	// 4. Log in again to get a fresh token for Bearer test
	loginBody, _ := json.Marshal(domain.LoginRequest{
		Email:    "csrf_test@strimlabs.dev",
		Password: "Str0ng!P@ssw0rd2026",
	})
	loginReq := httptest.NewRequest("POST", "/v1/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginResp, err := h.app.Test(loginReq, -1)
	require.NoError(t, err)

	var loginRes domain.Response
	_ = json.NewDecoder(loginResp.Body).Decode(&loginRes)
	freshToken := loginRes.AccessToken
	require.NotEmpty(t, freshToken)

	// 5. Bearer authenticated mutating request is EXEMPT from CSRF -> 200 OK
	bearerLogoutReq := httptest.NewRequest("POST", "/v1/auth/logout", nil)
	bearerLogoutReq.Header.Set("Authorization", "Bearer "+freshToken)
	bearerLogoutResp, err := h.app.Test(bearerLogoutReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, bearerLogoutResp.StatusCode)
}

func TestAuthHandler_RateLimiting(t *testing.T) {
	h := newHTTPTestHarness(t)

	// Attempting 6 calls on /v1/auth/forgot-password (limit is 5/min)
	reqBody, _ := json.Marshal(domain.ForgotPasswordRequest{
		Email: "rate_limit@strimlabs.dev",
	})

	var lastResp *fiber.Response
	_ = lastResp

	var got429 bool
	for i := 1; i <= 7; i++ {
		req := httptest.NewRequest("POST", "/v1/auth/forgot-password", bytes.NewReader(reqBody))
		req.Header.Set("Content-Type", "application/json")
		resp, err := h.app.Test(req, -1)
		require.NoError(t, err)

		if resp.StatusCode == fiber.StatusTooManyRequests {
			got429 = true
			assert.NotEmpty(t, resp.Header.Get("Retry-After"))
			assert.NotEmpty(t, resp.Header.Get("X-RateLimit-Limit"))
			break
		}
	}

	assert.True(t, got429, "Expected rate limit 429 response after exceeding 5 requests/minute")
}

func TestAuthHandler_GoogleOAuth_Routes(t *testing.T) {
	h := newHTTPTestHarness(t)

	// 1. Google login when not configured -> 501 Not Implemented
	req := httptest.NewRequest("GET", "/v1/auth/google/login", nil)
	resp, err := h.app.Test(req, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotImplemented, resp.StatusCode)

	// 2. Google callback with state mismatch -> Redirects with status=error
	callbackReq := httptest.NewRequest("GET", "/v1/auth/google/callback?state=xyz&code=abc", nil)
	callbackResp, err := h.app.Test(callbackReq, -1)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusFound, callbackResp.StatusCode)
	location := callbackResp.Header.Get("Location")
	assert.True(t, strings.Contains(location, "status=error"))
}
