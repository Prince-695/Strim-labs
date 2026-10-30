import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { swaggerUI } from "@hono/swagger-ui";
import { apiReference } from "@scalar/hono-api-reference";
import type { PrismaClient } from "@prisma/client";
import type { AppEnv } from "./types";
import { optionalAuth } from "./middleware/auth";
import { apiKeyAuth } from "./middleware/api-key";

// Domain Modules
import { authRoutes } from "./modules/auth";
import { usersRoutes } from "./modules/users";
import { orgsRoutes } from "./modules/org";
import { projectsRoutes } from "./modules/projects";
import { servicesRoutes } from "./modules/services";
import { ingestRoutes } from "./modules/ingest";
import { monitoringRoutes } from "./modules/monitoring";
import { dashboardsRoutes } from "./modules/dashboards";
import { alertsRoutes } from "./modules/alerts";
import { loadTestsRoutes } from "./modules/load-tests";
import { diagnosticsRoutes } from "./modules/diagnostics";
import { securityRoutes } from "./modules/security";
import { platformRoutes } from "./modules/platform";

export function createApp(db: PrismaClient) {
  const app = new OpenAPIHono<AppEnv>();

  // Register Security Schemes in OpenAPI Component Registry
  app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "JWT access token. Format: Bearer <access token>",
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
    type: "apiKey",
    in: "header",
    name: "X-Api-Key",
    description: "API Key for project telemetry ingestion or automation",
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "OrgIdHeader", {
    type: "apiKey",
    in: "header",
    name: "X-Organization-Id",
    description: "Active organization tenant context",
  });

  const envOrigins = (process.env.WEB_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://strim-labs.com",
    "https://staging.strim-labs.com",
    "https://strim-labs.vercel.app",
    ...envOrigins,
  ];

  // Global CORS Middleware
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return allowedOrigins[0];
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith(".vercel.app") ||
          origin.includes("localhost") ||
          origin.includes("127.0.0.1")
        ) {
          return origin;
        }
        return allowedOrigins[0];
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowHeaders: [
        "Content-Type",
        "content-type",
        "Authorization",
        "authorization",
        "X-Organization-Id",
        "x-organization-id",
        "X-Api-Key",
        "x-api-key",
        "Accept",
        "accept",
        "Origin",
        "origin",
      ],
      exposeHeaders: ["Content-Length", "X-Request-Id"],
      maxAge: 86400,
    })
  );

  // Database Injection Middleware
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });

  // Optional Token & Ingest Key Resolution
  app.use("*", optionalAuth);
  app.use("*", apiKeyAuth);

  // ─── OpenAPI 3.1 Spec Document ───────────────────────────────────────────────

  app.doc31("/api/v1/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "STRIM Labs REST API",
      version: "1.0.0",
      description:
        "Production-grade REST API for STRIM Labs — Multi-tenant API monitoring, continuous observability, breaking point detection, and distributed load testing SaaS.",
      contact: {
        name: "STRIM Labs Engineering",
        url: "https://strim-labs.com",
        email: "support@strim-labs.com",
      },
      license: {
        name: "Apache 2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0.html",
      },
    },
    servers: [
      {
        url: "https://strim-labs.com/api/v1",
        description: "Production HTTPS (Default)",
      },
      {
        url: "https://staging.strim-labs.com/api/v1",
        description: "Staging HTTPS",
      },
      {
        url: "http://localhost:3001/api/v1",
        description: "Local Development HTTP",
      },
    ],
    security: [{ BearerAuth: [] }, { OrgIdHeader: [] }],
  });

  // ─── Interactive Documentation (Swagger UI & Scalar) ────────────────────────

  // Swagger UI with server dropdown ("dropper"), Bearer Auth, persistent tokens, and logout capability
  app.get(
    "/docs",
    swaggerUI({
      url: "/api/v1/openapi.json",
      persistAuthorization: true,
    })
  );

  // Swagger UI Logout helper that clears persisted authorization from browser storage
  app.get("/docs/logout", (c) => {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Swagger UI - Logged Out</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 420px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
            h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.5; }
            a { display: inline-block; background: #6366f1; color: white; text-decoration: none; font-weight: 500; font-size: 0.875rem; padding: 0.625rem 1.25rem; border-radius: 8px; transition: background 0.15s ease; }
            a:hover { background: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Logged Out of Swagger UI</h1>
            <p>Saved authorization tokens and local session credentials have been cleared.</p>
            <a href="/docs">Return to Swagger UI</a>
          </div>
          <script>
            try {
              localStorage.removeItem("authorized");
              sessionStorage.clear();
            } catch (e) {}
          </script>
        </body>
      </html>
    `);
  });

  // Modern Scalar API Reference Documentation
  app.get(
    "/reference",
    apiReference({
      pageTitle: "STRIM Labs API Reference",
      spec: {
        url: "/api/v1/openapi.json",
      },
      theme: "purple",
    })
  );

  // Root redirect to interactive API docs
  app.get("/", (c) => c.redirect("/docs"));

  // Liveness alias for backward compatibility
  app.get("/health", (c) =>
    c.json({
      status: "ok",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
    })
  );

  // ─── Domain Route Mounting (/api/v1 prefix) ──────────────────────────────────

  // Domain 1: Authentication & Sessions
  app.route("/api/v1/auth", authRoutes);

  // Domain 2: Users & Profiles
  app.route("/api/v1/users", usersRoutes);

  // Domain 3: Organizations & Memberships
  app.route("/api/v1/organizations", orgsRoutes);

  // Domain 4: Projects & Quotas
  app.route("/api/v1/organizations/:orgId/projects", projectsRoutes);

  // Domain 5: Services, Discovery Runs, OpenAPI Spec Import, Endpoints
  app.route("/api/v1/organizations/:orgId/projects/:projectId/services", servicesRoutes);

  // Domain 6: Telemetry Ingest (SDK, OTel, Gateway)
  app.route("/api/v1/ingest", ingestRoutes);

  // Domain 7: Monitoring & Observability
  app.route("/api/v1/organizations/:orgId/projects/:projectId/monitoring", monitoringRoutes);

  // Domain 8: Dashboards & Custom Panels
  app.route("/api/v1/organizations/:orgId/projects/:projectId/dashboards", dashboardsRoutes);

  // Domain 9: Alerts, Incidents, Notification Channels
  app.route("/api/v1/organizations/:orgId/projects/:projectId/alerts", alertsRoutes);

  // Domain 10: Load Testing & Breaking Point Detection
  app.route("/api/v1/organizations/:orgId/projects/:projectId/load-tests", loadTestsRoutes);

  // Domain 11: Diagnostics & Regression Analysis
  app.route("/api/v1/organizations/:orgId/projects/:projectId/diagnostics", diagnosticsRoutes);

  // Domain 12: Security & Org Features (API Keys, Webhooks, Integrations, Audit Logs)
  app.route("/api/v1/organizations/:orgId", securityRoutes);

  // Domain 13: Platform & Health Probes (Live, Ready, Dependencies, Me, Usage)
  app.route("/api/v1", platformRoutes);

  // ─── Standardized Global Error Handler ───────────────────────────────────────

  app.onError((err, c) => {
    const status = (err as { status?: number }).status ?? 500;
    if (err.message === "TENANT_MISMATCH") {
      return c.json(
        {
          code: "FORBIDDEN",
          message: "Cross-tenant access denied: resource does not belong to active organization",
        },
        403
      );
    }
    return c.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: err.message || "An unexpected error occurred",
      },
      status as 500
    );
  });

  return app;
}
