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

	// Ingestion Subgroup: /v1/ingest (CI scanner & traffic ingest)
	ingest := v1.Group("/ingest")
	ingest.Post("/discovery", handlers.Discovery.IngestDiscovery)

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
