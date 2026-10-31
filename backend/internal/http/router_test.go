package http_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	apphttp "github.com/Prince-695/strim/backend/internal/http"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockSystemRepo struct {
	err error
}

func (m *mockSystemRepo) Ping(ctx context.Context) error {
	return m.err
}

func setupTestApp(t *testing.T, repoErr error) *fiber.App {
	cfg := &config.Config{
		AppEnv:          "test",
		ServerPort:      "8080",
		APIBaseURL:      "http://localhost:8080",
		WebOrigin:       "http://localhost:3000",
		AllowedOrigins:  []string{"http://localhost:3000"},
		LogLevel:        "error",
		RequestTimeout:  5 * time.Second,
		BodyLimitBytes:  2 * 1024 * 1024,
		SwaggerUser:     "admin",
		SwaggerPassword: "secretpassword",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	idGen := ids.NewUUIDv7Generator()

	repo := &mockSystemRepo{err: repoErr}
	sysSvc := service.NewSystemService(repo, logger)
	sysHandler := handlers.NewSystemHandler(sysSvc)
	container := handlers.NewContainer(sysHandler)

	return apphttp.NewRouter(cfg, container, logger, idGen)
}

func TestHealthEndpoint_Healthy(t *testing.T) {
	app := setupTestApp(t, nil)

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var body domain.Response
	err = json.NewDecoder(resp.Body).Decode(&body)
	require.NoError(t, err)

	assert.True(t, body.Success)
	assert.NotEmpty(t, body.RequestID)
	assert.NotEmpty(t, body.ResponseTime)

	dataMap, ok := body.Data.(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "healthy", dataMap["status"])
	assert.Equal(t, "connected", dataMap["database"])
}

func TestHealthEndpoint_Degraded(t *testing.T) {
	app := setupTestApp(t, errors.New("database connection refused"))

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusServiceUnavailable, resp.StatusCode)

	var body domain.Response
	err = json.NewDecoder(resp.Body).Decode(&body)
	require.NoError(t, err)
	assert.False(t, body.Success)
	assert.Equal(t, domain.ErrCodeServiceUnavailable, body.ErrorCode)
}

func TestNotFoundHandler(t *testing.T) {
	app := setupTestApp(t, nil)

	req := httptest.NewRequest("GET", "/v1/unknown-path", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)

	var body domain.Response
	err = json.NewDecoder(resp.Body).Decode(&body)
	require.NoError(t, err)
	assert.False(t, body.Success)
	assert.Equal(t, domain.ErrCodeNotFound, body.ErrorCode)
}

func TestSwaggerBasicAuth(t *testing.T) {
	app := setupTestApp(t, nil)

	// 1. Without credentials should be 401
	req := httptest.NewRequest("GET", "/swagger/index.html", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	// 2. With valid credentials
	reqWithAuth := httptest.NewRequest("GET", "/swagger/index.html", nil)
	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte("admin:secretpassword"))
	reqWithAuth.Header.Set("Authorization", authHeader)

	respAuth, err := app.Test(reqWithAuth)
	require.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respAuth.StatusCode)
}
