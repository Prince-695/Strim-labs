package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/logger"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/Prince-695/strim/backend/pkg/startup"
)

var (
	Version = "1.0.0"
	Commit  = "dev"
)

// @title STRIM Labs API
// @version 1.0
// @description STRIM Labs backend: API observability, load testing and capacity analysis.
// @termsOfService http://swagger.io/terms/
// @contact.name API Support
// @contact.email support@strimlabs.dev
// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html
// @BasePath /
// @schemes http https
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and then your token.
func main() {
	startTime := time.Now()

	// 1. Load strongly-typed Configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "CRITICAL: Configuration failure: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize Structured slog JSON Logger
	appLogger := logger.New(cfg.LogLevel, os.Stdout)

	// 3. Platform Utilities (UUIDv7 ID generator)
	idGen := ids.NewUUIDv7Generator()

	// 4. Initialize Database Connection (GORM PostgreSQL Pool)
	db, err := database.New(cfg, appLogger)
	if err != nil {
		appLogger.Warn("Database connection failed on startup (health endpoint will report degraded)",
			slog.Any("error", err),
		)
	} else {
		defer func() {
			if closeErr := db.Close(); closeErr != nil {
				appLogger.Error("Error closing database connections", slog.Any("error", closeErr))
			}
		}()

		// Auto-migrate core schema models
		if err := db.AutoMigrate(
			&domain.User{},
			&domain.RefreshToken{},
			&domain.OTPCode{},
			&domain.OAuthAccount{},
		); err != nil {
			appLogger.Error("Auto-migration failed", slog.Any("error", err))
		}
	}

	// 5. Dependency Injection: Repositories & Platform Caches
	systemRepo := repository.NewSystemRepository(db)
	userRepo := repository.NewUserRepository(db)
	authRepo := repository.NewAuthRepository(db)
	otpRepo := repository.NewOTPRepository(db)
	oauthRepo := repository.NewOAuthRepository(db)

	tokenCache := cache.NewMemoryCache()
	clk := clock.NewRealClock()
	mailerClient := mailer.NewConsoleMailer(appLogger)

	// 6. Dependency Injection: Services
	systemSvc := service.NewSystemService(systemRepo, appLogger)
	authSvc := service.NewAuthService(
		cfg,
		userRepo,
		authRepo,
		otpRepo,
		oauthRepo,
		mailerClient,
		tokenCache,
		clk,
		idGen,
		appLogger,
	)

	// 7. Dependency Injection: HTTP Handlers
	systemHandler := handlers.NewSystemHandler(systemSvc)
	authHandler := handlers.NewAuthHandler(authSvc, cfg)
	handlerContainer := handlers.NewContainer(systemHandler, authHandler)

	// 8. Build Router & Middlewares
	app := http.NewRouter(cfg, handlerContainer, appLogger, idGen)

	// 9. Display Startup Banner
	serverStatus := "ONLINE"
	statusDetails := "Database connected"
	if db == nil {
		serverStatus = "DEGRADED"
		statusDetails = "Database unreachable"
	}

	startup.PrintServerBanner(startup.Config{
		ServiceName:     "STRIM LABS",
		Version:         Version,
		Commit:          Commit,
		Environment:     cfg.AppEnv,
		Port:            cfg.ServerPort,
		APIBaseURL:      cfg.APIBaseURL,
		HealthEndpoint:  "/health",
		DocsEndpoint:    "/swagger/index.html",
		Status:          serverStatus,
		StatusDetails:   statusDetails,
		StartupDuration: time.Since(startTime),
	})

	// 10. Start Server in Background Goroutine
	listenAddr := fmt.Sprintf(":%s", cfg.ServerPort)
	serverErrors := make(chan error, 1)

	go func() {
		serverErrors <- app.Listen(listenAddr)
	}()

	// 11. Graceful Shutdown on Interrupt Signals
	shutdownSignals := make(chan os.Signal, 1)
	signal.Notify(shutdownSignals, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	select {
	case err := <-serverErrors:
		appLogger.Error("Fatal server error occurred", slog.Any("error", err))
		os.Exit(1)

	case <-shutdownSignals:
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = app.ShutdownWithContext(ctx)
	}
}
