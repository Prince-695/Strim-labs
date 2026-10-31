package config_test

import (
	"os"
	"testing"
	"time"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConfigLoadDefaults(t *testing.T) {
	// Clear any overrides for test
	os.Setenv("APP_ENV", "test")
	os.Setenv("SERVER_PORT", "9090")
	os.Setenv("API_BASE_URL", "http://localhost:9090")
	defer func() {
		os.Unsetenv("APP_ENV")
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("API_BASE_URL")
	}()

	cfg, err := config.Load()
	require.NoError(t, err)
	assert.Equal(t, "test", cfg.AppEnv)
	assert.Equal(t, "9090", cfg.ServerPort)
	assert.Equal(t, "http://localhost:9090", cfg.APIBaseURL)
	assert.Equal(t, 30*time.Second, cfg.RequestTimeout)
	assert.NotEmpty(t, cfg.AllowedOrigins)
	assert.Greater(t, cfg.DatabaseMaxOpenConns, 0)
}

func TestConfigValidationFailure(t *testing.T) {
	os.Setenv("APP_ENV", "invalid_environment")
	defer os.Unsetenv("APP_ENV")

	_, err := config.Load()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "configuration validation failed")
}
