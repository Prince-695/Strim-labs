package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Prince-695/strim/backend/internal/alerts"
	"github.com/Prince-695/strim/backend/internal/audit"
	"github.com/Prince-695/strim/backend/internal/cache"
	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/discovery"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/events"
	"github.com/Prince-695/strim/backend/internal/http"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/ingest"
	"github.com/Prince-695/strim/backend/internal/loadengine"
	"github.com/Prince-695/strim/backend/internal/notify"
	"github.com/Prince-695/strim/backend/internal/platform/clock"
	"github.com/Prince-695/strim/backend/internal/platform/database"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/Prince-695/strim/backend/internal/platform/logger"
	"github.com/Prince-695/strim/backend/internal/platform/mailer"
	"github.com/Prince-695/strim/backend/internal/platform/netguard"
	"github.com/Prince-695/strim/backend/internal/repository"
	"github.com/Prince-695/strim/backend/internal/service"
	"github.com/Prince-695/strim/backend/internal/sse"
	"github.com/Prince-695/strim/backend/pkg/startup"
)

var (
	Version = "1.0.0"
	Commit  = "dev"
	BuiltAt = ""
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

		// Schema synchronization controlled by DB_RUN
		if cfg.DBRun {
			fmt.Printf("\033[38;2;168;85;247m[DATABASE]\033[0m \033[38;2;192;132;252m⚡ DB_RUN=true: Synchronizing database schema and running auto-migrations...\033[0m\n")
			// Drop deprecated tables if present (stateless JWT dual-token architecture & renamed tables)
			_ = db.Exec("DROP TABLE IF EXISTS o_auth_accounts CASCADE").Error
			_ = db.Exec("DROP TABLE IF EXISTS refresh_tokens CASCADE").Error
			_ = db.Exec("DROP TABLE IF EXISTS otp_codes CASCADE").Error

			if err := db.AutoMigrate(
				&domain.User{},
				&domain.OTP{},
				&domain.Organization{},
				&domain.OrgMember{},
				&domain.Project{},
				&domain.ProjectVerification{},
				&domain.APIEndpoint{},
				&domain.EndpointSource{},
				&domain.DiscoveryRun{},
				&domain.RequestEvent{},
				&domain.RequestRollup1m{},
				&domain.RequestRollup1h{},
				&domain.LoadTest{},
				&domain.LoadTestResults{},
				&domain.LoadTestTimeseries{},
				&domain.Job{},
				&domain.CapacityReport{},
				&domain.AlertRule{},
				&domain.Incident{},
				&domain.IncidentEvent{},
				&domain.NotificationChannel{},
				&domain.NotificationLog{},
				&domain.APIKey{},
				&domain.Webhook{},
				&domain.WebhookDelivery{},
				&domain.AuditLog{},
				&domain.DailyUsageCounter{},
				&domain.Dashboard{},
			); err != nil {
				fmt.Printf("\033[38;2;239;68;68m[DATABASE]\033[0m \033[31m✗ Auto-migration failed: %v\033[0m\n", err)
			} else {
				fmt.Printf("\033[38;2;168;85;247m[DATABASE]\033[0m \033[38;2;192;132;252m✓ Schema migration complete: tables synchronized successfully (users, otp, organizations, org_members, projects, project_verifications, api_endpoints, endpoint_sources, discovery_runs, request_events_raw, request_rollup_1m, request_rollup_1h)\033[0m\n")
			}
		}
	}

	// 5. Dependency Injection: Repositories & Platform Caches
	var (
		systemRepo       repository.SystemRepository
		userRepo         repository.UserRepository
		otpRepo          repository.OTPRepository
		orgRepo          repository.OrgRepository
		memberRepo       repository.MemberRepository
		projectRepo      repository.ProjectRepository
		verificationRepo repository.VerificationRepository
		endpointRepo     repository.EndpointRepository
		loadTestRepo     repository.LoadTestRepository
		jobRepo          repository.JobRepository
		capacityRepo     repository.CapacityRepository
		alertRepo        repository.AlertRuleRepository
		incidentRepo     repository.IncidentRepository
		channelRepo      repository.NotificationChannelRepository
		apiKeyRepo       repository.APIKeyRepository
		webhookRepo      repository.WebhookRepository
		deliveryRepo     repository.WebhookDeliveryRepository
		auditRepo        repository.AuditLogRepository
		usageRepo        repository.UsageRepository
		dashboardRepo    repository.DashboardRepository
	)

	if db != nil && db.DB != nil {
		systemRepo = repository.NewSystemRepository(db)
		userRepo = repository.NewUserRepository(db)
		otpRepo = repository.NewOTPRepository(db)
		orgRepo = repository.NewOrgRepository(db)
		memberRepo = repository.NewMemberRepository(db)
		projectRepo = repository.NewProjectRepository(db)
		verificationRepo = repository.NewVerificationRepository(db)
		endpointRepo = repository.NewEndpointRepository(db)
		loadTestRepo = repository.NewLoadTestRepository(db)
		jobRepo = repository.NewJobRepository(db)
		capacityRepo = repository.NewCapacityRepository(db)
		alertRepo = repository.NewAlertRuleRepository(db)
		incidentRepo = repository.NewIncidentRepository(db)
		channelRepo = repository.NewNotificationChannelRepository(db)
		apiKeyRepo = repository.NewAPIKeyRepository(db)
		webhookRepo = repository.NewWebhookRepository(db)
		deliveryRepo = repository.NewWebhookDeliveryRepository(db)
		auditRepo = repository.NewAuditLogRepository(db)
		usageRepo = repository.NewUsageRepository(db)
		dashboardRepo = repository.NewDashboardRepository(db)
	} else {
		appLogger.Warn("Database unavailable on boot; initializing in-memory repository fallbacks for resilience")
		userRepoMem := repository.NewInMemoryUserRepository()
		memberRepoMem := repository.NewInMemoryMemberRepository(userRepoMem)
		orgRepoMem := repository.NewInMemoryOrgRepository(memberRepoMem)
		projectRepoMem := repository.NewInMemoryProjectRepository()
		verifRepoMem := repository.NewInMemoryVerificationRepository(projectRepoMem)
		endpointRepoMem := repository.NewInMemoryEndpointRepository()

		systemRepo = repository.NewSystemRepository(nil)
		userRepo = userRepoMem
		otpRepo = repository.NewInMemoryOTPRepository()
		orgRepo = orgRepoMem
		memberRepo = memberRepoMem
		projectRepo = projectRepoMem
		verificationRepo = verifRepoMem
		endpointRepo = endpointRepoMem
		loadTestRepo = repository.NewInMemoryLoadTestRepository()
		jobRepo = repository.NewInMemoryJobRepository()
		capacityRepo = repository.NewInMemoryCapacityRepository()
		alertRepo = repository.NewInMemoryAlertRuleRepository()
		incidentRepo = repository.NewInMemoryIncidentRepository()
		channelRepo = repository.NewInMemoryNotificationChannelRepository()
		apiKeyRepo = repository.NewInMemoryAPIKeyRepository()
		webhookRepo = repository.NewInMemoryWebhookRepository()
		deliveryRepo = repository.NewInMemoryWebhookDeliveryRepository()
		auditRepo = repository.NewInMemoryAuditLogRepository()
		usageRepo = repository.NewInMemoryUsageRepository()
		dashboardRepo = repository.NewInMemoryDashboardRepository()
	}

	tokenCache := cache.NewMemoryCache()
	tenantCache := cache.NewTenantCache(tokenCache)
	projectCache := cache.NewProjectCache(tokenCache)
	clk := clock.NewRealClock()

	ssrfGuard := netguard.NewSSRFGuard(nil)
	httpFetcher := service.NewSSRFSafeHTTPFetcher(ssrfGuard)
	verifEngine := service.NewVerificationEngine(nil, httpFetcher)
	openapiParser := discovery.NewOpenAPIParser(ssrfGuard)

	eventBus := events.NewInProcessBus(1000, 4)
	defer eventBus.Close()
	webhookDispatcher := events.NewWebhookDispatcher(webhookRepo, deliveryRepo, ssrfGuard, nil)
	webhookDispatcher.RegisterSubscriber(eventBus)
	auditRec := audit.NewAsyncRecorder(auditRepo)

	var mailerClient mailer.Mailer
	if cfg.SMTPHost != "" && cfg.SMTPUser != "" {
		mailerClient = mailer.NewSMTPMailer(mailer.SMTPConfig{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			User:     cfg.SMTPUser,
			Password: cfg.SMTPPass,
			From:     cfg.MailFrom,
		}, appLogger)
	} else {
		mailerClient = mailer.NewConsoleMailer(appLogger)
	}

	// 6. Dependency Injection: Services
	systemSvc := service.NewSystemService(systemRepo, appLogger)
	authSvc := service.NewAuthService(
		cfg,
		userRepo,
		otpRepo,
		mailerClient,
		tokenCache,
		clk,
		idGen,
		appLogger,
	)
	userSvc := service.NewUserService(userRepo)
	orgSvc := service.NewOrgService(orgRepo, memberRepo, userRepo, tenantCache)
	projectSvc := service.NewProjectService(projectRepo, verificationRepo, projectCache, ssrfGuard, verifEngine)
	endpointSvc := service.NewEndpointService(endpointRepo, projectRepo)
	discoverySvc := service.NewDiscoveryService(endpointRepo, projectRepo, openapiParser)

	// 7. Telemetry Ingestion Engine & TimeSeries Storage
	var ingestStore ingest.TimeSeriesStore
	if db != nil && db.DB != nil {
		ingestStore = ingest.NewGormTimeSeriesStore(db.DB)
	} else {
		ingestStore = ingest.NewInMemoryTimeSeriesStore()
	}

	batcher := ingest.NewBatcher(ingest.BatcherConfig{}, ingestStore, endpointRepo, appLogger)
	batcher.Start()
	defer batcher.Stop()

	rollupWorker := ingest.NewRollupWorker(ingestStore, appLogger)
	rollupWorker.Start()
	defer rollupWorker.Stop()

	// 8. Observability & Real-Time Metrics Engine
	metricsCache := cache.NewMetricsCache(tokenCache)
	metricsSvc := service.NewMetricsService(ingestStore, endpointRepo, projectRepo, metricsCache, clk)
	sseHub := sse.NewHub()

	// 9. Dependency Injection: HTTP Handlers
	buildInfo := domain.BuildInfo{
		Version: Version,
		Commit:  Commit,
		BuiltAt: BuiltAt,
	}
	systemHandler := handlers.NewSystemHandler(systemSvc, buildInfo)
	authHandler := handlers.NewAuthHandler(authSvc, cfg)
	userHandler := handlers.NewUserHandler(userSvc)
	orgHandler := handlers.NewOrgHandler(orgSvc)
	memberHandler := handlers.NewMemberHandler(orgSvc)
	projectHandler := handlers.NewProjectHandler(projectSvc)
	endpointHandler := handlers.NewEndpointHandler(endpointSvc)
	discoveryHandler := handlers.NewDiscoveryHandler(discoverySvc)
	ingestHandler := handlers.NewIngestHandler(batcher, projectRepo, clk)
	metricsHandler := handlers.NewMetricsHandler(metricsSvc, sseHub, appLogger)

	// 9. Load Testing Engine & Distributed Execution
	loadWorker := loadengine.NewWorker("", jobRepo, loadTestRepo, projectRepo, capacityRepo, nil, sseHub, cfg.JWTSecret, appLogger)
	go loadWorker.Start(context.Background())
	loadTestSvc := service.NewLoadTestService(loadTestRepo, projectRepo, jobRepo, loadWorker, ssrfGuard, cfg.JWTSecret, clk)
	loadTestHandler := handlers.NewLoadTestHandler(loadTestSvc, sseHub, appLogger)

	// 10. Capacity Analysis and Comparison Engine
	capacitySvc := service.NewCapacityService(capacityRepo, loadTestRepo)
	capacityHandler := handlers.NewCapacityHandler(capacitySvc, appLogger)

	// 11. Diagnostics Engine
	diagnosticsSvc := service.NewDiagnosticsService(ingestStore, endpointRepo, loadTestRepo, projectRepo, clk)
	diagnosticsHandler := handlers.NewDiagnosticsHandler(diagnosticsSvc, appLogger)

	// 12. Alerting, Incidents, and Notification Channels Engine
	dispatcher := notify.NewDispatcher(mailerClient, ssrfGuard, appLogger)
	alertEvaluator := alerts.NewEvaluator(
		alertRepo,
		incidentRepo,
		channelRepo,
		endpointRepo,
		ingestStore,
		dispatcher,
		clk,
		idGen,
		appLogger,
	)
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			_ = alertEvaluator.EvaluateAll(context.Background())
		}
	}()

	alertSvc := service.NewAlertService(alertRepo, projectRepo, endpointRepo, channelRepo, clk, idGen)
	incidentSvc := service.NewIncidentService(incidentRepo, projectRepo, clk, idGen)
	channelSvc := service.NewNotificationService(channelRepo, projectRepo, dispatcher, ssrfGuard, clk, idGen)

	alertHandler := handlers.NewAlertHandler(alertSvc, appLogger)
	incidentHandler := handlers.NewIncidentHandler(incidentSvc, appLogger)
	channelHandler := handlers.NewChannelHandler(channelSvc, appLogger)

	// 13. API Keys, Webhooks, Audit Logs, and Usage Engine
	apiKeySvc := service.NewAPIKeyService(apiKeyRepo, projectRepo, auditRec)
	webhookSvc := service.NewWebhookService(webhookRepo, deliveryRepo, projectRepo, ssrfGuard, webhookDispatcher, auditRec)
	auditSvc := service.NewAuditService(auditRepo, orgRepo)
	usageSvc := service.NewUsageService(usageRepo, projectRepo, orgRepo)
	dashboardSvc := service.NewDashboardService(dashboardRepo, projectRepo, auditRec)

	ingestHandler.SetServices(apiKeySvc, usageSvc)
	discoveryHandler.SetAPIKeyService(apiKeySvc)

	apiKeyHandler := handlers.NewAPIKeyHandler(apiKeySvc, appLogger)
	webhookHandler := handlers.NewWebhookHandler(webhookSvc, appLogger)
	auditHandler := handlers.NewAuditHandler(auditSvc, appLogger)
	usageHandler := handlers.NewUsageHandler(usageSvc, appLogger)
	dashboardHandler := handlers.NewDashboardHandler(dashboardSvc, appLogger)

	handlerContainer := handlers.NewContainer(
		systemHandler,
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
		alertHandler,
		incidentHandler,
		channelHandler,
		dashboardHandler,
		apiKeyHandler,
		webhookHandler,
		auditHandler,
		usageHandler,
	)

	// 10. Build Router & Middlewares
	app := http.NewRouter(cfg, handlerContainer, appLogger, idGen)

	// 9. Display Startup Banner
	serverStatus := "ONLINE"
	statusDetails := "Database connected"
	if db == nil {
		serverStatus = "DEGRADED"
		statusDetails = "Database unreachable"
	} else if cfg.DBRun {
		statusDetails = "Database connected (sync enabled)"
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
