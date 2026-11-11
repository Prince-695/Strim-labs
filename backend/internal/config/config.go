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
	DBRun                bool

	// Swagger Auth
	SwaggerUser     string `validate:"required"`
	SwaggerPassword string `validate:"required"`

	// JWT & Security
	JWTSecret          string        `validate:"required,min=16"`
	AccessTokenExpiry  time.Duration `validate:"required"`
	RefreshTokenExpiry time.Duration `validate:"required"`

	// SMTP Email Configuration
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	MailFrom string

	// OAuth (Google & GitHub)
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string

	GitHubClientID     string
	GitHubClientSecret string
	GitHubRedirectURI  string

	// Limits
	IngestMaxRPS   int `validate:"required,min=10"`
	LoadTestMaxRPS int `validate:"required,min=10"`

	// Optional / External
	StrimAPIKey string
	RedisURL    string
}

// Load reads configuration from environment variables and optionally loads a .env file.
func Load() (*Config, error) {
	// Attempt loading .env file if it exists; do not fail if absent
	_ = godotenv.Load()

	serverPort := getEnvFirst([]string{"PORT", "SERVER_PORT"}, "8080")

	// Resolve environment name with alias support
	rawEnv := strings.ToLower(getEnvFirst([]string{"ENV", "APP_ENV"}, "development"))
	switch rawEnv {
	case "dev":
		rawEnv = "development"
	case "prod":
		rawEnv = "production"
	}

	// Resolve frontend URL & allowed origins
	rawFrontendURL := getEnvFirst([]string{"FRONTEND_URL", "WEB_ORIGIN"}, "http://localhost:5173")
	frontendOrigins := parseCommaSeparated(rawFrontendURL)
	primaryWebOrigin := "http://localhost:5173"
	if len(frontendOrigins) > 0 {
		primaryWebOrigin = frontendOrigins[0]
	}

	rawAllowedOrigins := getEnvFirst([]string{"ALLOWED_ORIGINS", "FRONTEND_URL"}, "http://localhost:5173,https://strim-labs.vercel.app,http://localhost:3000")
	allowedList := parseCommaSeparated(rawAllowedOrigins)
	// Ensure primary frontend origins are included in allowed CORS list
	for _, fOrigin := range frontendOrigins {
		found := false
		for _, aOrigin := range allowedList {
			if strings.EqualFold(aOrigin, fOrigin) {
				found = true
				break
			}
		}
		if !found {
			allowedList = append(allowedList, fOrigin)
		}
	}

	cfg := &Config{
		AppEnv:         rawEnv,
		ServerPort:     serverPort,
		APIBaseURL:     getEnvFirst([]string{"API_BASE_URL", "RENDER_EXTERNAL_URL"}, fmt.Sprintf("http://localhost:%s", serverPort)),
		WebOrigin:      primaryWebOrigin,
		AllowedOrigins: allowedList,
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		RequestTimeout: time.Duration(getEnvInt("REQUEST_TIMEOUT_SECONDS", 30)) * time.Second,
		BodyLimitBytes: getEnvInt("BODY_LIMIT_BYTES", 2*1024*1024), // 2MB default

		DatabaseURL:          getEnv("DATABASE_URL", "postgresql://user:password@localhost:5432/strim_internal?sslmode=disable"),
		DatabaseMaxOpenConns: getEnvInt("DATABASE_MAX_OPEN_CONNS", 25),
		DatabaseMaxIdleConns: getEnvInt("DATABASE_MAX_IDLE_CONNS", 10),
		DatabaseConnMaxLife:  time.Duration(getEnvInt("DATABASE_CONN_MAX_LIFETIME_MINUTES", 15)) * time.Minute,
		DBRun:                getEnvBool("DB_RUN", false),

		SwaggerUser:     getEnv("SWAGGER_USER", "admin"),
		SwaggerPassword: getEnvFirst([]string{"SWAGGER_PASS", "SWAGGER_PASSWORD"}, "strim_docs_2026"),

		JWTSecret:          getEnv("JWT_SECRET", "your_super_secret_jwt_key_at_least_32_characters"),
		AccessTokenExpiry:  getEnvDuration("ACCESS_TOKEN_EXPIRY", time.Duration(getEnvInt("ACCESS_TOKEN_TTL_MINUTES", 30))*time.Minute),
		RefreshTokenExpiry: getEnvDuration("REFRESH_TOKEN_EXPIRY", time.Duration(getEnvInt("REFRESH_TOKEN_TTL_DAYS", 7))*24*time.Hour),

		SMTPHost: getEnv("SMTP_HOST", ""),
		SMTPPort: getEnvInt("SMTP_PORT", 465),
		SMTPUser: getEnv("SMTP_USER", ""),
		SMTPPass: getEnvFirst([]string{"SMTP_PASS", "SMTP_PASSWORD"}, ""),
		MailFrom: getEnvFirst([]string{"MAIL_FROM", "SMTP_USER"}, ""),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnvFirst([]string{"GOOGLE_CALLBACK_URL", "GOOGLE_REDIRECT_URI"}, ""),

		GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		GitHubRedirectURI:  getEnvFirst([]string{"GITHUB_CALLBACK_URL", "GITHUB_REDIRECT_URI"}, ""),

		IngestMaxRPS:   getEnvInt("INGEST_MAX_RPS", 2000),
		LoadTestMaxRPS: getEnvInt("LOADTEST_MAX_RPS", 5000),

		StrimAPIKey: getEnv("STRIM_API_KEY", ""),
		RedisURL:    getEnv("REDIS_URL", ""),
	}

	validate := validator.New()
	if err := validate.Struct(cfg); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return cfg, nil
}

// Helper utilities for environment extraction
func getEnvFirst(keys []string, defaultVal string) string {
	for _, key := range keys {
		if val, ok := os.LookupEnv(key); ok && strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val)
		}
	}
	return defaultVal
}

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

func getEnvBool(key string, defaultVal bool) bool {
	if valStr, ok := os.LookupEnv(key); ok && strings.TrimSpace(valStr) != "" {
		lower := strings.ToLower(strings.TrimSpace(valStr))
		return lower == "true" || lower == "1" || lower == "yes" || lower == "on"
	}
	return defaultVal
}

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if valStr, ok := os.LookupEnv(key); ok && strings.TrimSpace(valStr) != "" {
		trimmed := strings.TrimSpace(valStr)
		// Support "d" suffix (e.g. "7d")
		if strings.HasSuffix(trimmed, "d") {
			daysStr := strings.TrimSuffix(trimmed, "d")
			if days, err := strconv.Atoi(daysStr); err == nil {
				return time.Duration(days) * 24 * time.Hour
			}
		}
		if d, err := time.ParseDuration(trimmed); err == nil {
			return d
		}
		if mins, err := strconv.Atoi(trimmed); err == nil {
			return time.Duration(mins) * time.Minute
		}
	}
	return defaultVal
}
