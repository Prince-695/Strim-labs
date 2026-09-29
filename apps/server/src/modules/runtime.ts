import { Hono } from "hono";
import { computeHealthScore } from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { queue } from "../lib/queue";
import { queryMetrics, queryTimeseries } from "../lib/clickhouse";

export const runtimeRoutes = new Hono<AppEnv>();
runtimeRoutes.use("*", requireAuth, requireOrg);

runtimeRoutes.get("/overview", async (c) => {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);

  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const env = await db.environment.findFirst({
    where: { id: environmentId, organizationId },
    include: { application: true },
  });
  if (!env) return c.json({ error: "NOT_FOUND" }, 404);

  // 1. Fetch real-time metrics from analytics engine (ClickHouse or Postgres fallback)
  const metrics = await queryMetrics(db, {
    organizationId,
    environmentId,
    minutesBack: 15,
  });

  const latestHealthSnapshot = await db.runtimeHealthSnapshot.findFirst({
    where: { environmentId, organizationId },
    orderBy: { capturedAt: "desc" },
  });

  const version = await db.runtimeVersion.findFirst({
    where: { environmentId, organizationId, approved: true },
    orderBy: { seq: "desc" },
  });

  const incidents = await db.incident.findMany({
    where: { environmentId, organizationId, status: "open" },
    take: 5,
  });

  // Calculate live health score using real metrics if available
  const computedHealth = computeHealthScore({
    errorRate: metrics.errorRate,
    availability: Math.max(0, 1 - metrics.errorRate),
    p95Ms: metrics.p95Ms || 50,
    rps: metrics.rps,
  });

  const healthScore = metrics.totalRequests > 0 ? computedHealth.score : latestHealthSnapshot?.score ?? 98;
  const breakdown = metrics.totalRequests > 0 ? computedHealth.breakdown : latestHealthSnapshot?.breakdown ?? {
    availability: 100,
    latency: 95,
    errors: 100,
    dependencies: 100,
    cache: 90,
  };

  return c.json({
    application: env.application.name,
    environment: env.name,
    health: {
      score: healthScore,
      breakdown,
    },
    traffic: { rps: metrics.rps || latestHealthSnapshot?.rps || 0 },
    latency: {
      p50: metrics.p50Ms || 25,
      p95: metrics.p95Ms || latestHealthSnapshot?.p95Ms || 60,
      p99: metrics.p99Ms || latestHealthSnapshot?.p99Ms || 110,
    },
    errorRate: metrics.errorRate || latestHealthSnapshot?.errorRate || 0,
    totalRequests: metrics.totalRequests,
    currentVersion: version,
    activeIncidents: incidents,
  });
});

runtimeRoutes.get("/timeseries", async (c) => {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);

  const minutes = Number(c.req.query("minutes") ?? 60);
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;

  const points = await queryTimeseries(db, {
    organizationId,
    environmentId,
    minutesBack: minutes,
    buckets: 12,
  });

  return c.json({ points });
});

runtimeRoutes.get("/events", (c) => {
  const organizationId = c.get("organizationId")!;
  return c.json({ events: queue.recent(organizationId).slice(-50) });
});
