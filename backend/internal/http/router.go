package http

import (
	"log/slog"
	"time"

	"github.com/Prince-695/strim/backend/internal/config"
	"github.com/Prince-695/strim/backend/internal/domain"
	"github.com/Prince-695/strim/backend/internal/http/handlers"
	"github.com/Prince-695/strim/backend/internal/http/middleware"
	"github.com/Prince-695/strim/backend/internal/platform/ids"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/swagger"

	_ "github.com/Prince-695/strim/backend/docs"
)

// NewRouter constructs and configures the Fiber application with middlewares and routes.
func NewRouter(
	cfg *config.Config,
	handlers *handlers.Container,
	logger *slog.Logger,
	idGen ids.IDGenerator,
) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:               "STRIM Labs API",
		BodyLimit:             cfg.BodyLimitBytes,
		ErrorHandler:          domain.CentralErrorHandler(logger),
		DisableStartupMessage: true,
		StrictRouting:         false,
		CaseSensitive:         true,
	})

	// Global Middlewares Pipeline
	app.Use(middleware.RequestID(idGen))
	app.Use(middleware.Recover(logger))
	app.Use(middleware.HTTPLogger(logger))
	app.Use(middleware.SecurityHeaders(cfg))
	app.Use(middleware.CORSConfig(cfg))
	app.Use(middleware.Timeout(cfg.RequestTimeout))

	// Root endpoint for platform probes and basic service status
	app.Get("/", func(c *fiber.Ctx) error {
		return domain.SendOK(c, fiber.Map{
			"name":   "STRIM Labs API",
			"status": "healthy",
			"docs":   "/swagger/index.html",
		}, nil)
	})
	app.Head("/", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	// System Health Route
	app.Get("/health", handlers.System.Health)

	// Swagger Documentation (Protected by HTTP Basic Auth)
	swaggerGroup := app.Group("/swagger")
	swaggerGroup.Use(middleware.SwaggerBasicAuth(cfg))
	swaggerGroup.Get("/*", swagger.HandlerDefault)

	// Route Group: /v1
	v1 := app.Group("/v1")

	// Auth Middlewares
	authRateLimit := middleware.RateLimit(5, 1*time.Minute)
	requireAuth := middleware.RequireAuth(handlers.Auth.AuthService(), cfg.JWTSecret)
	csrfGuard := middleware.CSRFProtection(cfg)

	// Subgroup: /v1/auth
	auth := v1.Group("/auth")

	// Public Auth Endpoints
	auth.Post("/signup", authRateLimit, handlers.Auth.Signup)
	auth.Post("/login", authRateLimit, handlers.Auth.Login)
	auth.Post("/refresh", handlers.Auth.Refresh)
	auth.Post("/forgot-password", authRateLimit, handlers.Auth.ForgotPassword)
	auth.Post("/reset-password", authRateLimit, handlers.Auth.ResetPassword)
	auth.Get("/google/login", handlers.Auth.GoogleLogin)
	auth.Get("/google/callback", handlers.Auth.GoogleCallback)

	// Protected Auth Endpoints
	auth.Get("/me", requireAuth, handlers.Auth.Me)
	auth.Post("/logout", requireAuth, csrfGuard, handlers.Auth.Logout)
	auth.Post("/change-password", requireAuth, csrfGuard, handlers.Auth.ChangePassword)
	auth.Post("/otp/send", requireAuth, authRateLimit, handlers.Auth.SendOTP)
	auth.Post("/otp/verify", requireAuth, handlers.Auth.VerifyOTP)

	// Middlewares for Phase 2
	requireVerified := middleware.RequireVerified()
	usernameRateLimit := middleware.RateLimit(30, 1*time.Minute)

	// Subgroup: /v1/users
	users := v1.Group("/users")
	users.Get("/username", usernameRateLimit, handlers.User.CheckUsername)
	users.Get("/me", requireAuth, handlers.User.GetMe)
	users.Post("/username", requireAuth, requireVerified, csrfGuard, handlers.User.SetUsername)
	users.Put("/update", requireAuth, requireVerified, csrfGuard, handlers.User.UpdateProfile)

	// Subgroup: /v1/organizations
	orgs := v1.Group("/organizations")
	orgs.Post("/", requireAuth, requireVerified, csrfGuard, handlers.Org.CreateOrg)
	orgs.Get("/", requireAuth, requireVerified, handlers.Org.ListOrgs)

	// Tenant-Scoped Routes: /v1/organizations/:orgID
	resolveTenant := middleware.ResolveTenant(handlers.Org.OrgService())
	requireViewer := middleware.RequireRole(domain.RoleViewer)
	requireMember := middleware.RequireRole(domain.RoleMember)
	requireAdmin := middleware.RequireRole(domain.RoleAdmin)
	requireOwner := middleware.RequireRole(domain.RoleOwner)

	tenant := orgs.Group("/:orgID", requireAuth, requireVerified, resolveTenant)
	tenant.Get("/", requireViewer, handlers.Org.GetOrg)
	tenant.Put("/", requireAdmin, csrfGuard, handlers.Org.UpdateOrg)
	tenant.Delete("/", requireOwner, csrfGuard, handlers.Org.DeleteOrg)
	tenant.Get("/audit-logs", requireAdmin, handlers.Audit.ListAuditLogs)
	tenant.Get("/usage", requireAdmin, handlers.Usage.GetUsage)

	// Members Sub-Routes: /v1/organizations/:orgID/members
	members := tenant.Group("/members")
	members.Post("/", requireAdmin, csrfGuard, handlers.Member.AddMember)
	members.Get("/", requireViewer, handlers.Member.ListMembers)
	members.Put("/:userID/role", requireAdmin, csrfGuard, handlers.Member.UpdateRole)
	members.Delete("/:userID", requireAdmin, csrfGuard, handlers.Member.RemoveMember)
	members.Post("/leave", requireMember, csrfGuard, handlers.Member.LeaveOrg)

	// Projects Sub-Routes: /v1/organizations/:orgID/projects
	projects := tenant.Group("/projects")
	projects.Post("/", requireAdmin, csrfGuard, handlers.Project.CreateProject)
	projects.Get("/", requireViewer, handlers.Project.ListProjects)
	projects.Get("/:projectID", requireViewer, handlers.Project.GetProject)
	projects.Put("/:projectID", requireAdmin, csrfGuard, handlers.Project.UpdateProject)
	projects.Delete("/:projectID", requireAdmin, csrfGuard, handlers.Project.DeleteProject)

	// Verification Sub-Routes: /v1/organizations/:orgID/projects/:projectID/verification
	projects.Post("/:projectID/verification", requireAdmin, csrfGuard, handlers.Project.InitiateVerification)
	projects.Post("/:projectID/verification/check", requireAdmin, csrfGuard, handlers.Project.CheckVerification)
	projects.Get("/:projectID/verification", requireViewer, handlers.Project.GetVerificationStatus)

	// Registry Endpoints Sub-Routes: /v1/organizations/:orgID/projects/:projectID/endpoints
	projects.Get("/:projectID/endpoints", requireViewer, handlers.Endpoint.ListEndpoints)
	projects.Get("/:projectID/endpoints/:endpointID", requireViewer, handlers.Endpoint.GetEndpoint)
	projects.Patch("/:projectID/endpoints/:endpointID", requireMember, csrfGuard, handlers.Endpoint.PatchEndpoint)

	// Discovery Sub-Routes: /v1/organizations/:orgID/projects/:projectID/discovery
	projects.Post("/:projectID/discovery/openapi", requireAdmin, csrfGuard, handlers.Discovery.ImportOpenAPI)
	projects.Post("/:projectID/discovery/manifest", requireAdmin, csrfGuard, handlers.Discovery.ImportManifest)
	projects.Get("/:projectID/discovery/runs", requireViewer, handlers.Discovery.ListDiscoveryRuns)

	// Metrics Sub-Routes: /v1/organizations/:orgID/projects/:projectID/metrics
	metrics := projects.Group("/:projectID/metrics")
	metrics.Get("/overview", requireViewer, handlers.Metrics.GetOverview)
	metrics.Get("/timeseries", requireViewer, handlers.Metrics.GetTimeseries)
	metrics.Get("/endpoints", requireViewer, handlers.Metrics.GetEndpointsMetrics)
	metrics.Get("/status-codes", requireViewer, handlers.Metrics.GetStatusCodes)
	metrics.Get("/hosts", requireViewer, handlers.Metrics.GetHostsMetrics)
	metrics.Get("/stream", requireViewer, handlers.Metrics.StreamMetrics)

	// Load Tests Sub-Routes: /v1/organizations/:orgID/projects/:projectID/load-tests
	loadTests := projects.Group("/:projectID/load-tests")
	loadTests.Post("/", requireMember, csrfGuard, handlers.LoadTest.CreateLoadTest)
	loadTests.Get("/", requireViewer, handlers.LoadTest.ListLoadTests)
	loadTests.Post("/compare", requireViewer, handlers.Capacity.CompareLoadTests)
	loadTests.Get("/:testID", requireViewer, handlers.LoadTest.GetLoadTest)
	loadTests.Post("/:testID/stop", requireMember, csrfGuard, handlers.LoadTest.StopLoadTest)
	loadTests.Post("/:testID/rerun", requireMember, csrfGuard, handlers.LoadTest.RerunLoadTest)
	loadTests.Delete("/:testID", requireAdmin, csrfGuard, handlers.LoadTest.DeleteLoadTest)
	loadTests.Get("/:testID/results", requireViewer, handlers.LoadTest.GetResults)
	loadTests.Get("/:testID/timeseries", requireViewer, handlers.LoadTest.GetTimeseries)
	loadTests.Get("/:testID/progress", requireViewer, handlers.LoadTest.StreamProgress)
	loadTests.Get("/:testID/capacity", requireViewer, handlers.Capacity.GetCapacityReport)
	loadTests.Post("/:testID/capacity/recompute", requireMember, csrfGuard, handlers.Capacity.RecomputeCapacity)

	// Diagnostics Sub-Routes: /v1/organizations/:orgID/projects/:projectID/diagnostics
	diag := projects.Group("/:projectID/diagnostics")
	diag.Get("/slow-endpoints", requireViewer, handlers.Diagnostics.GetSlowEndpoints)
	diag.Get("/regressions", requireViewer, handlers.Diagnostics.GetRegressions)
	diag.Get("/bottlenecks", requireViewer, handlers.Diagnostics.GetBottlenecks)

	// Customizable Dashboards Sub-Routes: /v1/organizations/:orgID/projects/:projectID/dashboards
	dashboards := projects.Group("/:projectID/dashboards")
	dashboards.Post("/", requireMember, csrfGuard, handlers.Dashboard.CreateDashboard)
	dashboards.Get("/", requireViewer, handlers.Dashboard.ListDashboards)
	dashboards.Get("/:dashboardID", requireViewer, handlers.Dashboard.GetDashboard)
	dashboards.Put("/:dashboardID", requireMember, csrfGuard, handlers.Dashboard.UpdateDashboard)
	dashboards.Delete("/:dashboardID", requireMember, csrfGuard, handlers.Dashboard.DeleteDashboard)
	dashboards.Post("/:dashboardID/clone", requireMember, csrfGuard, handlers.Dashboard.CloneDashboard)

	// Alert Rules Sub-Routes: /v1/organizations/:orgID/projects/:projectID/alert-rules
	alertRules := projects.Group("/:projectID/alert-rules")
	alertRules.Post("/", requireMember, csrfGuard, handlers.Alert.CreateRule)
	alertRules.Get("/", requireViewer, handlers.Alert.ListRules)
	alertRules.Get("/:ruleID", requireViewer, handlers.Alert.GetRule)
	alertRules.Put("/:ruleID", requireMember, csrfGuard, handlers.Alert.UpdateRule)
	alertRules.Delete("/:ruleID", requireMember, csrfGuard, handlers.Alert.DeleteRule)
	alertRules.Post("/:ruleID/mute", requireMember, csrfGuard, handlers.Alert.MuteRule)

	// Incidents Sub-Routes: /v1/organizations/:orgID/projects/:projectID/incidents
	incidents := projects.Group("/:projectID/incidents")
	incidents.Get("/", requireViewer, handlers.Incident.ListIncidents)
	incidents.Get("/:incidentID", requireViewer, handlers.Incident.GetIncident)
	incidents.Post("/:incidentID/acknowledge", requireMember, csrfGuard, handlers.Incident.AcknowledgeIncident)
	incidents.Post("/:incidentID/resolve", requireMember, csrfGuard, handlers.Incident.ResolveIncident)
	incidents.Post("/:incidentID/comments", requireMember, csrfGuard, handlers.Incident.AddComment)

	// Notification Channels Sub-Routes: /v1/organizations/:orgID/projects/:projectID/notification-channels
	channels := projects.Group("/:projectID/notification-channels")
	channels.Post("/", requireAdmin, csrfGuard, handlers.Channel.CreateChannel)
	channels.Get("/", requireViewer, handlers.Channel.ListChannels)
	channels.Get("/:channelID", requireViewer, handlers.Channel.GetChannel)
	channels.Put("/:channelID", requireAdmin, csrfGuard, handlers.Channel.UpdateChannel)
	channels.Delete("/:channelID", requireAdmin, csrfGuard, handlers.Channel.DeleteChannel)
	channels.Post("/:channelID/test", requireAdmin, csrfGuard, handlers.Channel.TestChannel)

	// API Keys Sub-Routes: /v1/organizations/:orgID/projects/:projectID/api-keys
	apiKeys := projects.Group("/:projectID/api-keys")
	apiKeys.Post("/", requireAdmin, csrfGuard, handlers.APIKey.CreateKey)
	apiKeys.Get("/", requireAdmin, handlers.APIKey.ListKeys)
	apiKeys.Post("/:keyID/rotate", requireAdmin, csrfGuard, handlers.APIKey.RotateKey)
	apiKeys.Delete("/:keyID", requireAdmin, csrfGuard, handlers.APIKey.RevokeKey)

	// Webhooks Sub-Routes: /v1/organizations/:orgID/projects/:projectID/webhooks
	webhooks := projects.Group("/:projectID/webhooks")
	webhooks.Post("/", requireAdmin, csrfGuard, handlers.Webhook.CreateWebhook)
	webhooks.Get("/", requireAdmin, handlers.Webhook.ListWebhooks)
	webhooks.Put("/:webhookID", requireAdmin, csrfGuard, handlers.Webhook.UpdateWebhook)
	webhooks.Delete("/:webhookID", requireAdmin, csrfGuard, handlers.Webhook.DeleteWebhook)
	webhooks.Get("/:webhookID/deliveries", requireAdmin, handlers.Webhook.ListDeliveries)
	webhooks.Post("/:webhookID/deliveries/:deliveryID/redeliver", requireAdmin, csrfGuard, handlers.Webhook.Redeliver)

	// Ingestion Subgroup: /v1/ingest (CI scanner & traffic ingest)
	ingest := v1.Group("/ingest")
	ingest.Post("/discovery", handlers.Discovery.IngestDiscovery)
	ingest.Post("/events", handlers.Ingest.IngestEvents)

	// Catch-all 404 handler returning standard Response envelope
	app.Use(func(c *fiber.Ctx) error {
		return domain.SendError(
			c,
			fiber.StatusNotFound,
			domain.ErrCodeNotFound,
			"The requested resource was not found",
			fiber.Map{
				"path":   c.Path(),
				"method": c.Method(),
			},
		)
	})

	return app
}
