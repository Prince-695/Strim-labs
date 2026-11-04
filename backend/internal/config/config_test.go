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
	assert.Equal(t, 30*time.Minute, cfg.AccessTokenExpiry)
	assert.Equal(t, 168*time.Hour, cfg.RefreshTokenExpiry)
	assert.NotEmpty(t, cfg.AllowedOrigins)
	assert.Greater(t, cfg.DatabaseMaxOpenConns, 0)
	assert.False(t, cfg.DBRun)
}

func TestConfigValidationFailure(t *testing.T) {
	os.Setenv("APP_ENV", "invalid_environment")
	defer os.Unsetenv("APP_ENV")

	_, err := config.Load()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "configuration validation failed")
}

func TestConfigMinimizedEnvAliases(t *testing.T) {
	os.Setenv("PORT", "8080")
	os.Setenv("ENV", "development")
	os.Setenv("ALLOWED_ORIGINS", "http://localhost:5173,https://seasyn.vercel.app,http://localhost:3000")
	os.Setenv("FRONTEND_URL", "http://localhost:5173,https://seasyn.vercel.app")
	os.Setenv("DATABASE_URL", "postgresql://user:password@localhost:5432/seasyn_internal?sslmode=disable")
	os.Setenv("DB_RUN", "true")
	os.Setenv("JWT_SECRET", "your_super_secret_jwt_key_at_least_32_characters")
	os.Setenv("ACCESS_TOKEN_EXPIRY", "30m")
	os.Setenv("REFRESH_TOKEN_EXPIRY", "168h")
	os.Setenv("SMTP_HOST", "smtp.gmail.com")
	os.Setenv("SMTP_PORT", "465")
	os.Setenv("SMTP_USER", "your_account@gmail.com")
	os.Setenv("SMTP_PASS", "xxxx_xxxx_xxxx_xxxx")
	os.Setenv("MAIL_FROM", "your_account@gmail.com")
	os.Setenv("GOOGLE_CLIENT_ID", "your_google_client_id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "your_google_client_secret")
	os.Setenv("GOOGLE_CALLBACK_URL", "http://localhost:8080/v1/auth/google/callback")
	os.Setenv("GITHUB_CLIENT_ID", "your_github_client_id")
	os.Setenv("GITHUB_CLIENT_SECRET", "your_github_client_secret")
	os.Setenv("GITHUB_CALLBACK_URL", "http://localhost:8080/v1/auth/github/callback")
	os.Setenv("SWAGGER_USER", "admin")
	os.Setenv("SWAGGER_PASS", "seasyn_docs_2026")

	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("ENV")
		os.Unsetenv("ALLOWED_ORIGINS")
		os.Unsetenv("FRONTEND_URL")
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("DB_RUN")
		os.Unsetenv("JWT_SECRET")
		os.Unsetenv("ACCESS_TOKEN_EXPIRY")
		os.Unsetenv("REFRESH_TOKEN_EXPIRY")
		os.Unsetenv("SMTP_HOST")
		os.Unsetenv("SMTP_PORT")
		os.Unsetenv("SMTP_USER")
		os.Unsetenv("SMTP_PASS")
		os.Unsetenv("MAIL_FROM")
		os.Unsetenv("GOOGLE_CLIENT_ID")
		os.Unsetenv("GOOGLE_CLIENT_SECRET")
		os.Unsetenv("GOOGLE_CALLBACK_URL")
		os.Unsetenv("GITHUB_CLIENT_ID")
		os.Unsetenv("GITHUB_CLIENT_SECRET")
		os.Unsetenv("GITHUB_CALLBACK_URL")
		os.Unsetenv("SWAGGER_USER")
		os.Unsetenv("SWAGGER_PASS")
	}()

	cfg, err := config.Load()
	require.NoError(t, err)
	assert.Equal(t, "development", cfg.AppEnv)
	assert.Equal(t, "8080", cfg.ServerPort)
	assert.Equal(t, "http://localhost:5173", cfg.WebOrigin)
	assert.Contains(t, cfg.AllowedOrigins, "http://localhost:5173")
	assert.Contains(t, cfg.AllowedOrigins, "https://seasyn.vercel.app")
	assert.True(t, cfg.DBRun)
	assert.Equal(t, "smtp.gmail.com", cfg.SMTPHost)
	assert.Equal(t, 465, cfg.SMTPPort)
	assert.Equal(t, "your_account@gmail.com", cfg.SMTPUser)
	assert.Equal(t, "xxxx_xxxx_xxxx_xxxx", cfg.SMTPPass)
	assert.Equal(t, "your_account@gmail.com", cfg.MailFrom)
	assert.Equal(t, "http://localhost:8080/v1/auth/google/callback", cfg.GoogleRedirectURI)
	assert.Equal(t, "your_github_client_id", cfg.GitHubClientID)
	assert.Equal(t, "http://localhost:8080/v1/auth/github/callback", cfg.GitHubRedirectURI)
	assert.Equal(t, "seasyn_docs_2026", cfg.SwaggerPassword)
}
