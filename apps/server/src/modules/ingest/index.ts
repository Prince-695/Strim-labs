import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  IngestRegisterSchema,
  IngestHeartbeatSchema,
  IngestRouteManifestSchema,
  IngestMetricsSchema,
  IngestEventsSchema,
  IngestTracesSchema,
  IngestLogsSchema,
  ApiErrorSchema,
} from "../../lib/schemas";
import { requireIngestKey } from "../../middleware/tenant";

export const ingestRoutes = new OpenAPIHono<AppEnv>();

// ─── GET /ingest/ping ─────────────────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "get",
    path: "/ping",
    tags: ["SDK Ingestion"],
    summary: "Ingestion gateway ping",
    description: "Verify ingestion endpoint reachability and latency from SDK client.",
    responses: {
      200: {
        description: "Gateway healthy",
        content: { "application/json": { schema: z.object({ ok: z.boolean(), service: z.string(), timestamp: z.string() }) } },
      },
    },
  }),
  async (c) => {
    return c.json({ ok: true, service: "strim-ingestion-gateway", timestamp: new Date().toISOString() }, 200);
  },
);

// Require ingest key for all subsequent ingestion endpoints
ingestRoutes.use("*", requireIngestKey);

// ─── POST /ingest/register ────────────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/register",
    tags: ["SDK Ingestion"],
    summary: "Register SDK instance",
    description: "Registers an active runtime instance of the @strim/sdk or OpenTelemetry bridge.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: IngestRegisterSchema } }, required: true },
    },
    responses: {
      200: {
        description: "Service registered",
        content: {
          "application/json": {
            schema: z.object({
              ok: z.boolean(),
              serviceId: z.string(),
              projectId: z.string(),
              registeredAt: z.string(),
            }),
          },
        },
      },
      401: { description: "Invalid ingest key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const projectId = c.get("projectId")!;
    const body = c.req.valid("json");
    const db = c.get("db");

    // Upsert monitored service under this project
    const service = await db.service.upsert({
      where: { projectId_name_environment: { projectId, name: body.serviceName, environment: body.environment } },
      create: {
        projectId,
        name: body.serviceName,
        baseUrl: "http://localhost",
        environment: body.environment,
        framework: body.framework ?? null,
        status: "HEALTHY",
      },
      update: {
        environment: body.environment,
        framework: body.framework ?? undefined,
        status: "HEALTHY",
      },
    });

    await db.project.update({
      where: { id: projectId },
      data: { status: "ACTIVE" },
    });

    return c.json({
      ok: true,
      serviceId: service.id,
      projectId,
      registeredAt: new Date().toISOString(),
    }, 200);
  },
);

// ─── POST /ingest/heartbeats ──────────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/heartbeats",
    tags: ["SDK Ingestion"],
    summary: "Ingest daemon heartbeat",
    description: "Periodic heartbeat from SDK daemon with CPU, memory, uptime stats.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: IngestHeartbeatSchema } }, required: true },
    },
    responses: {
      200: { description: "Heartbeat accepted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      401: { description: "Invalid ingest key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    return c.json({ ok: true }, 200);
  },
);

// ─── POST /ingest/route-manifests ─────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/route-manifests",
    tags: ["SDK Ingestion"],
    summary: "Ingest route manifest",
    description: "SDK auto-reports discovered routes from framework routers (e.g. Hono, Express, Next.js).",
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: IngestRouteManifestSchema } }, required: true },
    },
    responses: {
      200: {
        description: "Manifest processed",
        content: { "application/json": { schema: z.object({ ok: z.boolean(), registeredRoutes: z.number() }) } },
      },
      401: { description: "Invalid ingest key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const projectId = c.get("projectId")!;
    const { routes } = c.req.valid("json");
    const db = c.get("db");

    for (const r of routes) {
      await db.discoveredRoute.upsert({
        where: { projectId_method_path: { projectId, method: r.method, path: r.path } },
        create: { projectId, path: r.path, method: r.method, totalCalls: 0 },
        update: {},
      });
    }

    return c.json({ ok: true, registeredRoutes: routes.length }, 200);
  },
);

// ─── POST /ingest/metrics ─────────────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/metrics",
    tags: ["SDK Ingestion"],
    summary: "Ingest telemetry batch",
    description: "Bulk telemetry events sent from SDK middleware with latency, status codes, paths.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: IngestMetricsSchema } }, required: true },
    },
    responses: {
      200: {
        description: "Batch ingested",
        content: { "application/json": { schema: z.object({ ok: z.boolean(), count: z.number() }) } },
      },
      401: { description: "Invalid ingest key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const projectId = c.get("projectId")!;
    const { events } = c.req.valid("json");
    const db = c.get("db");

    const sumDuration = events.reduce((acc, e) => acc + e.durationMs, 0);
    const avgDuration = events.length > 0 ? sumDuration / events.length : 0;
    const errors = events.filter((e) => e.statusCode >= 400).length;

    await db.telemetryMetric.create({
      data: {
        projectId,
        totalRequests: events.length,
        successCount: events.length - errors,
        errorCount: errors,
        p50Ms: avgDuration,
        p95Ms: avgDuration * 1.5,
        p99Ms: avgDuration * 2.5,
        rps: events.length,
        errorRate: events.length > 0 ? errors / events.length : 0,
      },
    });

    return c.json({ ok: true, count: events.length }, 200);
  },
);

// ─── POST /ingest/events ──────────────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/events",
    tags: ["SDK Ingestion"],
    summary: "Ingest custom events",
    description: "Ingest custom business or operational events from SDK client.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: IngestEventsSchema } }, required: true },
    },
    responses: {
      200: { description: "Events accepted", content: { "application/json": { schema: z.object({ ok: z.boolean(), count: z.number() }) } } },
      401: { description: "Invalid ingest key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const { events } = c.req.valid("json");
    return c.json({ ok: true, count: events.length }, 200);
  },
);

// ─── POST /ingest/traces ──────────────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/traces",
    tags: ["SDK Ingestion"],
    summary: "Ingest OpenTelemetry spans",
    description: "Ingest OTel / distributed tracing spans from microservices.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: IngestTracesSchema } }, required: true },
    },
    responses: {
      200: { description: "Spans accepted", content: { "application/json": { schema: z.object({ ok: z.boolean(), count: z.number() }) } } },
      401: { description: "Invalid ingest key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const { spans } = c.req.valid("json");
    return c.json({ ok: true, count: spans.length }, 200);
  },
);

// ─── POST /ingest/logs ────────────────────────────────────────────────────────

ingestRoutes.openapi(
  createRoute({
    method: "post",
    path: "/logs",
    tags: ["SDK Ingestion"],
    summary: "Ingest structured logs",
    description: "Ingest structured application logs correlated with traceId.",
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: IngestLogsSchema } }, required: true },
    },
    responses: {
      200: { description: "Logs accepted", content: { "application/json": { schema: z.object({ ok: z.boolean(), count: z.number() }) } } },
      401: { description: "Invalid ingest key", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const { logs } = c.req.valid("json");
    return c.json({ ok: true, count: logs.length }, 200);
  },
);
