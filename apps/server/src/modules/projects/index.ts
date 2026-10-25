import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types";
import { requireOrg } from "../../middleware/tenant";

const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  baseUrl: z.string().url("Must be a valid URL").optional(),
  targetUrl: z.string().url("Must be a valid target URL").optional(),
  defaultMethod: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
  defaultHeaders: z.record(z.string()).optional(),
});

export const projectRoutes = new Hono<AppEnv>();

projectRoutes.use("*", requireOrg);

/**
 * List all projects in the current organization
 * Includes latest breakpoint test run and route counts
 */
projectRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const projects = await db.project.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: {
          testRuns: true,
          discoveredRoutes: true,
          telemetryMetrics: true,
        },
      },
      testRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          name: true,
          status: true,
          avgRps: true,
          peakRps: true,
          p95Ms: true,
          breakingPoint: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ projects, maxProjects: 5 });
});

/**
 * Create a new project with strict 5-project limit & API key generation
 */
projectRoutes.post("/", zValidator("json", createProjectSchema), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = c.req.valid("json");
  const db = c.get("db");

  // Enforce HARD LIMIT: max 5 projects per organization
  const currentCount = await db.project.count({
    where: { organizationId },
  });

  if (currentCount >= 5) {
    return c.json(
      {
        error: "PROJECT_LIMIT_EXCEEDED",
        message: "Maximum limit of 5 projects per organization reached. Upgrade or delete an existing project.",
      },
      400
    );
  }

  const generatedKey = `strim_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const targetUrl = body.targetUrl || body.baseUrl || "http://localhost:3000";
  const baseUrl = body.baseUrl || body.targetUrl || "http://localhost:3000";

  const project = await db.project.create({
    data: {
      organizationId,
      name: body.name,
      baseUrl,
      targetUrl,
      defaultMethod: body.defaultMethod,
      defaultHeaders: body.defaultHeaders as object,
      apiKey: generatedKey,
      apiKeyPrefix: "strim_live_",
      status: "PENDING_SDK",
    },
  });

  return c.json({ project, apiKey: generatedKey }, 201);
});

/**
 * Get single project details
 */
projectRoutes.get("/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const project = await db.project.findFirst({
    where: { id, organizationId },
    include: {
      testRuns: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      discoveredRoutes: {
        orderBy: { lastSeenAt: "desc" },
        take: 15,
      },
      _count: {
        select: {
          discoveredRoutes: true,
          testRuns: true,
          telemetryMetrics: true,
        },
      },
    },
  });

  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  return c.json({ project });
});

/**
 * Get project continuous observability metrics
 */
projectRoutes.get("/:id/observability", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const project = await db.project.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true, status: true, baseUrl: true, targetUrl: true, createdAt: true },
  });

  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  // Fetch telemetry points from past 24 hours
  const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const metrics = await db.telemetryMetric.findMany({
    where: {
      projectId: id,
      timestamp: { gte: past24h },
    },
    orderBy: { timestamp: "asc" },
    take: 120,
  });

  // Aggregate totals
  let totalRequests = 0;
  let totalSuccess = 0;
  let totalWarning = 0;
  let totalError = 0;
  let p50Sum = 0;
  let p95Sum = 0;
  let p99Sum = 0;

  for (const m of metrics) {
    totalRequests += m.totalRequests;
    totalSuccess += m.successCount;
    totalWarning += m.warningCount;
    totalError += m.errorCount;
    p50Sum += m.p50Ms;
    p95Sum += m.p95Ms;
    p99Sum += m.p99Ms;
  }

  const count = metrics.length || 1;
  const passRatio = totalRequests > 0 ? Number(((totalSuccess / totalRequests) * 100).toFixed(1)) : 100;
  const failRatio = totalRequests > 0 ? Number((((totalWarning + totalError) / totalRequests) * 100).toFixed(1)) : 0;

  // Latest breakpoint diagnosis
  const latestTest = await db.testRun.findFirst({
    where: { projectId: id, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      breakingPoint: true,
      avgRps: true,
      peakRps: true,
      p95Ms: true,
      errorRate: true,
      createdAt: true,
    },
  });

  return c.json({
    project,
    observability: {
      status: project.status,
      totalRequests,
      totalSuccess,
      totalWarning,
      totalError,
      passRatio,
      failRatio,
      avgP50Ms: Math.round(p50Sum / count),
      avgP95Ms: Math.round(p95Sum / count),
      avgP99Ms: Math.round(p99Sum / count),
      recentMetrics: metrics,
      latestBreakpoint: latestTest?.breakingPoint ?? null,
      latestTestRun: latestTest ?? null,
    },
  });
});

/**
 * Get all auto-discovered routes registered by @strim/sdk
 */
projectRoutes.get("/:id/discovered-routes", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const project = await db.project.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });

  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  const routes = await db.discoveredRoute.findMany({
    where: { projectId: id },
    orderBy: { lastSeenAt: "desc" },
  });

  return c.json({ routes, total: routes.length });
});

/**
 * Regenerate Project API Key
 */
projectRoutes.post("/:id/api-key/regenerate", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const project = await db.project.findFirst({
    where: { id, organizationId },
  });

  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  const newKey = `strim_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const updated = await db.project.update({
    where: { id },
    data: { apiKey: newKey },
    select: { id: true, name: true, apiKey: true, apiKeyPrefix: true, updatedAt: true },
  });

  return c.json({ project: updated, apiKey: newKey });
});

/**
 * Delete a project
 */
projectRoutes.delete("/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const project = await db.project.findFirst({ where: { id, organizationId } });
  if (!project) {
    return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  }

  await db.project.delete({ where: { id } });
  return c.json({ success: true });
});
