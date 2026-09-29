import { Hono } from "hono";
import { apiReference } from "@scalar/hono-api-reference";
import { swaggerUI } from "@hono/swagger-ui";
import type { AppEnv } from "../types";

export const docsRoutes = new Hono<AppEnv>();

const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Strim API",
    version: "1.0.0",
    description:
      "Runtime intelligence and change platform API. Know what a change will do before production finds out.",
    contact: {
      name: "Strim Engineering",
      url: "https://strim.dev",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local Development Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "User session token or programmatic API key (sk_...)",
      },
      organizationHeader: {
        type: "apiKey",
        in: "header",
        name: "x-organization-id",
        description: "Active tenant organization identifier",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
        },
        required: ["error"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          name: { type: "string" },
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
        },
      },
      HealthScore: {
        type: "object",
        properties: {
          score: { type: "number" },
          breakdown: {
            type: "object",
            additionalProperties: { type: "number" },
          },
        },
      },
      ChangePlan: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          state: {
            type: "string",
            enum: [
              "DRAFT",
              "VALIDATING",
              "SIMULATION_PENDING",
              "SIMULATING",
              "SIMULATION_PASSED",
              "SIMULATION_FAILED",
              "APPROVAL_PENDING",
              "APPROVED",
              "REJECTED",
              "ROLLING_OUT",
              "ROLLOUT_PAUSED",
              "MONITORING",
              "COMPLETED",
              "ROLLBACK_PENDING",
              "ROLLED_BACK",
            ],
          },
          riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          rolloutPercent: { type: "number" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  tags: [
    { name: "Auth", description: "Authentication and session lifecycle" },
    { name: "Directory", description: "Organizations, workspaces, projects, apps, and teams" },
    { name: "API Keys", description: "Scoped programmatic credentials" },
    { name: "Runtime", description: "Live runtime health, RPS, latency, and time-series metrics" },
    { name: "Requests & Traces", description: "Request inspection, span waterfalls, and comparison" },
    { name: "Replay", description: "Safe production request replay" },
    { name: "Topology", description: "Dynamic dependency graph and blast radius" },
    { name: "Configuration", description: "Versioned runtime parameters and diffs" },
    { name: "Cache", description: "Cache rules, invalidation, and intelligence" },
    { name: "Simulations", description: "What-If scenarios and comparison engine" },
    { name: "Load Testing", description: "Production-derived load and breaking point analysis" },
    { name: "Change Plans", description: "Core change lifecycle, canary rollouts, and rollback" },
    { name: "Incidents", description: "Continuous anomaly detection and root cause correlation" },
    { name: "Policies", description: "Hierarchical rate limits, guardrails, and drift" },
    { name: "AI Copilot", description: "Grounded runtime intelligence queries" },
    { name: "Integrations", description: "GitHub webhooks, CI/CD gates, and deployments" },
    { name: "Audit", description: "Immutable audit logs and compliance export" },
  ],
  paths: {
    "/v1/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Register new user and organization",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string" },
                  organizationName: { type: "string" },
                },
                required: ["email", "password", "name", "organizationName"],
              },
            },
          },
        },
        responses: {
          201: { description: "User registered and session established" },
          400: { description: "Validation error" },
          409: { description: "Email already registered" },
        },
      },
    },
    "/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Authenticate user and create session",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          200: { description: "Session created" },
          401: { description: "Invalid credentials" },
          429: { description: "Rate limited" },
        },
      },
    },
    "/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke session and clear session cookie",
        responses: {
          200: { description: "Logged out" },
        },
      },
    },
    "/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get authenticated user profile and memberships",
        responses: {
          200: { description: "User profile" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/v1/runtime/overview": {
      get: {
        tags: ["Runtime"],
        summary: "Fetch real-time health score, throughput, latency, and active version",
        parameters: [
          {
            name: "environmentId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Runtime overview data" },
          404: { description: "Environment not found" },
        },
      },
    },
    "/v1/runtime/timeseries": {
      get: {
        tags: ["Runtime"],
        summary: "Fetch time-series throughput, latency percentiles, and errors for charts",
        parameters: [
          {
            name: "environmentId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "minutes",
            in: "query",
            schema: { type: "number", default: 60 },
          },
        ],
        responses: {
          200: { description: "Time-series points array" },
        },
      },
    },
    "/v1/change-plans": {
      get: {
        tags: ["Change Plans"],
        summary: "List change plans",
        parameters: [
          {
            name: "environmentId",
            in: "query",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "List of change plans" },
        },
      },
      post: {
        tags: ["Change Plans"],
        summary: "Draft a new Change Plan with proposed runtime state",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  environmentId: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  objective: { type: "string" },
                  proposed: { type: "object" },
                  gitCommit: { type: "string" },
                  gitPullRequest: { type: "string" },
                },
                required: ["environmentId", "title", "description", "objective", "proposed"],
              },
            },
          },
        },
        responses: {
          201: { description: "Change plan created in DRAFT state" },
        },
      },
    },
    "/v1/change-plans/{id}": {
      get: {
        tags: ["Change Plans"],
        summary: "Get change plan details, diff, approvals, and rollout status",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Change plan details" },
          404: { description: "Not found" },
        },
      },
    },
    "/v1/change-plans/{id}/simulate": {
      post: {
        tags: ["Change Plans"],
        summary: "Run What-If simulation comparing baseline vs proposed state",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Simulation completed" },
        },
      },
    },
    "/v1/change-plans/{id}/approve": {
      post: {
        tags: ["Change Plans"],
        summary: "Approve change plan for rollout",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  override: { type: "boolean" },
                  justification: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Approved" },
          409: { description: "Conflict / cannot approve" },
        },
      },
    },
    "/v1/change-plans/{id}/rollout": {
      post: {
        tags: ["Change Plans"],
        summary: "Advance canary rollout stage (10% -> 25% -> 50% -> 100%)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Rollout stage advanced" },
        },
      },
    },
    "/v1/change-plans/{id}/rollback": {
      post: {
        tags: ["Change Plans"],
        summary: "Instant 1-click rollback to previous Runtime Version",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Rolled back" },
        },
      },
    },
    "/v1/simulations": {
      get: {
        tags: ["Simulations"],
        summary: "List simulations",
        responses: {
          200: { description: "List of simulations" },
        },
      },
      post: {
        tags: ["Simulations"],
        summary: "Execute What-If scenario against baseline traffic",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  environmentId: { type: "string" },
                  change: {
                    type: "object",
                    properties: {
                      kind: {
                        type: "string",
                        enum: ["traffic", "cache", "timeout", "dependencyLatency", "dependencyUnavailable"],
                      },
                      multiplier: { type: "number" },
                      enabled: { type: "boolean" },
                      fromMs: { type: "number" },
                      toMs: { type: "number" },
                      factor: { type: "number" },
                      dependency: { type: "string" },
                    },
                    required: ["kind"],
                  },
                },
                required: ["environmentId", "change"],
              },
            },
          },
        },
        responses: {
          201: { description: "Simulation executed" },
        },
      },
    },
    "/v1/cache/rules": {
      get: {
        tags: ["Cache"],
        summary: "List cache rules",
        responses: { 200: { description: "List of cache rules" } },
      },
      post: {
        tags: ["Cache"],
        summary: "Create cache rule",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  environmentId: { type: "string" },
                  endpoint: { type: "string" },
                  method: { type: "string" },
                  ttlSeconds: { type: "number" },
                  tags: { type: "array", items: { type: "string" } },
                },
                required: ["environmentId", "endpoint", "method", "ttlSeconds"],
              },
            },
          },
        },
        responses: { 201: { description: "Rule created" } },
      },
    },
    "/v1/cache/invalidate": {
      post: {
        tags: ["Cache"],
        summary: "Trigger targeted or global cache invalidation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["manual", "tag", "endpoint"] },
                  cacheRuleId: { type: "string" },
                  tag: { type: "string" },
                  endpoint: { type: "string" },
                },
                required: ["kind"],
              },
            },
          },
        },
        responses: { 200: { description: "Invalidation dispatched" } },
      },
    },
    "/v1/cache/analytics": {
      get: {
        tags: ["Cache"],
        summary: "Get real cache performance metrics (hit rate, origin reduction, bandwidth saved)",
        parameters: [{ name: "environmentId", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Analytics data" } },
      },
    },
    "/v1/cache/recommendations": {
      get: {
        tags: ["Cache"],
        summary: "Scan telemetry to recommend cache candidates",
        parameters: [{ name: "environmentId", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Recommended endpoints" } },
      },
    },
    "/v1/incidents": {
      get: {
        tags: ["Incidents"],
        summary: "List incidents",
        responses: { 200: { description: "List of incidents" } },
      },
    },
    "/v1/incidents/{id}": {
      get: {
        tags: ["Incidents"],
        summary: "Get incident with unified timeline and ranked contributing factors",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Incident details" } },
      },
    },
    "/v1/incidents/{id}/rollback": {
      post: {
        tags: ["Incidents"],
        summary: "Trigger instant rollback for change plan correlated to incident",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Rollback executed" } },
      },
    },
    "/v1/ai/query": {
      post: {
        tags: ["AI Copilot"],
        summary: "Ask natural language question grounded in the tenant's Runtime Model",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  question: { type: "string" },
                },
                required: ["question"],
              },
            },
          },
        },
        responses: {
          200: { description: "Grounded answer with citations and uncertainty notice" },
        },
      },
    },
    "/v1/integrations/ci/gate": {
      post: {
        tags: ["Integrations"],
        summary: "CI/CD pipeline simulation gate (API Key authenticated)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  changePlanId: { type: "string" },
                  p95RegressionPct: { type: "number" },
                  thresholdPct: { type: "number", default: 20 },
                },
                required: ["changePlanId", "p95RegressionPct"],
              },
            },
          },
        },
        responses: {
          200: { description: "Evaluation result: PASS or FAIL" },
        },
      },
    },
  },
};

// Serve OpenAPI 3.1 JSON Specification
docsRoutes.get("/openapi.json", (c) => c.json(openApiSpec));

// Serve Official Swagger UI
docsRoutes.get("/swagger", swaggerUI({ url: "/v1/openapi.json" }));
docsRoutes.get("/swagger-ui", swaggerUI({ url: "/v1/openapi.json" }));

// Serve Scalar Interactive Documentation UI
docsRoutes.get(
  "/docs",
  apiReference({
    spec: {
      url: "/v1/openapi.json",
    },
    theme: "purple",
    pageTitle: "Strim API Documentation",
  }),
);
