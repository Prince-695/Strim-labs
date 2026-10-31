package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
)

// Config holds all validated configuration for the STRIM backend application.
type Config struct {
	// Server
	AppEnv         string        `validate:"required,oneof=development staging production test"`
	ServerPort     string        `validate:"required"`
	APIBaseURL     string        `validate:"required,url"`
	WebOrigin      string        `validate:"required"`
	AllowedOrigins []string      `validate:"required"`
	LogLevel       string        `validate:"required,oneof=debug info warn error"`
	RequestTimeout time.Duration `validate:"required"`
	BodyLimitBytes int           `validate:"required,min=1024"`

	// Database (GORM / PostgreSQL)
	DatabaseURL          string        `validate:"required"`
	DatabaseMaxOpenConns int           `validate:"required,min=1"`
	DatabaseMaxIdleConns int           `validate:"required,min=1"`
	DatabaseConnMaxLife  time.Duration `validate:"required"`

	// Swagger Auth
	SwaggerUser     string `validate:"required"`
	SwaggerPassword string `validate:"required"`

	// JWT & Security
	JWTSecret       string        `validate:"required,min=16"`
	AccessTokenTTL  time.Duration `validate:"required"`
	RefreshTokenTTL time.Duration `validate:"required"`

	// Limits
	IngestMaxRPS   int `validate:"required,min=10"`
	LoadTestMaxRPS int `validate:"required,min=10"`

	// Optional / External
	StrimAPIKey        string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	RedisURL           string
}

// Load reads configuration from environment variables and optionally loads a .env file.
func Load() (*Config, error) {
	// Attempt loading .env file if it exists; do not fail if absent
	_ = godotenv.Load()

	cfg := &Config{
		AppEnv:         getEnv("APP_ENV", "development"),
		ServerPort:     getEnv("SERVER_PORT", "8080"),
		APIBaseURL:     getEnv("API_BASE_URL", "http://localhost:8080"),
		WebOrigin:      getEnv("WEB_ORIGIN", "http://localhost:3000"),
		AllowedOrigins: parseCommaSeparated(getEnv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080")),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		RequestTimeout: time.Duration(getEnvInt("REQUEST_TIMEOUT_SECONDS", 30)) * time.Second,
		BodyLimitBytes: getEnvInt("BODY_LIMIT_BYTES", 2*1024*1024), // 2MB default

		DatabaseURL:          getEnv("DATABASE_URL", "postgresql://strim:strim@localhost:5432/strim"),
		DatabaseMaxOpenConns: getEnvInt("DATABASE_MAX_OPEN_CONNS", 25),
		DatabaseMaxIdleConns: getEnvInt("DATABASE_MAX_IDLE_CONNS", 10),
		DatabaseConnMaxLife:  time.Duration(getEnvInt("DATABASE_CONN_MAX_LIFETIME_MINUTES", 15)) * time.Minute,

		SwaggerUser:     getEnv("SWAGGER_USER", "admin"),
		SwaggerPassword: getEnv("SWAGGER_PASSWORD", "admin"),

		JWTSecret:       getEnv("JWT_SECRET", "strim-labs-development-super-secret-jwt-key-32chars"),
		AccessTokenTTL:  time.Duration(getEnvInt("ACCESS_TOKEN_TTL_MINUTES", 15)) * time.Minute,
		RefreshTokenTTL: time.Duration(getEnvInt("REFRESH_TOKEN_TTL_DAYS", 7)) * 24 * time.Hour,

		IngestMaxRPS:   getEnvInt("INGEST_MAX_RPS", 2000),
		LoadTestMaxRPS: getEnvInt("LOADTEST_MAX_RPS", 5000),

		StrimAPIKey:        getEnv("STRIM_API_KEY", ""),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", ""),
		RedisURL:           getEnv("REDIS_URL", ""),
	}

	validate := validator.New()
	if err := validate.Struct(cfg); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return cfg, nil
}

// Helper utilities for environment extraction
func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if valStr, ok := os.LookupEnv(key); ok && strings.TrimSpace(valStr) != "" {
		if val, err := strconv.Atoi(strings.TrimSpace(valStr)); err == nil {
			return val
		}
	}
	return defaultVal
}

func parseCommaSeparated(val string) []string {
	parts := strings.Split(val, ",")
	results := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			results = append(results, trimmed)
		}
	}
	return results
}
