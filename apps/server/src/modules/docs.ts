import { Hono } from "hono";
import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { swaggerUI } from "@hono/swagger-ui";
import type { AppEnv } from "../types";
import { authRoutes } from "./auth";
import { directoryRoutes } from "./directory";
import { keyRoutes } from "./keys";
import { auditRoutes } from "./audit";
import { ingestRoutes } from "./ingest";
import { runtimeRoutes } from "./runtime";
import { requestRoutes } from "./requests";
import { topologyRoutes } from "./topology";
import { replayRoutes } from "./replay";
import { configRoutes } from "./config";
import { cacheRoutes } from "./cache";
import { simulationRoutes } from "./simulations";
import { loadTestRoutes } from "./load-testing";
import { changePlanRoutes } from "./change-plans";
import { incidentRoutes } from "./incidents";
import { policyRoutes } from "./policies";

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
      url: process.env.API_BASE_URL ?? "http://localhost:8080",
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

export function getFullOpenApiSpec() {
  const registry = new OpenAPIHono<AppEnv>();
  registry.route("/v1/auth", authRoutes);
  registry.route("/v1/org", directoryRoutes);
  registry.route("/v1/api-keys", keyRoutes);
  registry.route("/v1/audit", auditRoutes);
  registry.route("/", ingestRoutes);
  registry.route("/v1/runtime", runtimeRoutes);
  registry.route("/v1/requests", requestRoutes);
  registry.route("/v1/topology", topologyRoutes);
  registry.route("/v1/replay", replayRoutes);
  registry.route("/v1/config", configRoutes);
  registry.route("/v1/cache", cacheRoutes);
  registry.route("/v1/simulations", simulationRoutes);
  registry.route("/v1/load-tests", loadTestRoutes);
  registry.route("/v1/change-plans", changePlanRoutes);
  registry.route("/v1/incidents", incidentRoutes);
  registry.route("/v1/policies", policyRoutes);

  const generated = registry.getOpenAPIDocument({
    openapi: "3.1.0",
    info: openApiSpec.info,
    servers: openApiSpec.servers,
  });

  return {
    ...openApiSpec,
    paths: {
      ...openApiSpec.paths,
      ...generated.paths,
    },
    components: {
      ...openApiSpec.components,
      schemas: {
        ...openApiSpec.components.schemas,
        ...generated.components?.schemas,
      },
    },
  };
}

// Serve OpenAPI 3.1 JSON Specification
docsRoutes.get("/openapi.json", (c) => c.json(getFullOpenApiSpec()));

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
