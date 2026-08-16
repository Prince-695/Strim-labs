import { Hono } from "hono";
import { computeHealthScore } from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { queue } from "../lib/queue";

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
  const latest = await db.runtimeHealthSnapshot.findFirst({
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
  const health =
    latest ??
    (() => {
      const h = computeHealthScore({
        errorRate: 0,
        availability: 1,
        p95Ms: 0,
        rps: 0,
      });
      return {
        score: h.score,
        breakdown: h.breakdown,
        rps: 0,
        p95Ms: 0,
        p99Ms: 0,
        errorRate: 0,
      };
    })();
  return c.json({
    application: env.application.name,
    environment: env.name,
    health: {
      score: health.score,
      breakdown: health.breakdown,
    },
    traffic: { rps: health.rps },
    latency: { p95: health.p95Ms, p99: health.p99Ms },
    errorRate: health.errorRate,
    currentVersion: version,
    activeIncidents: incidents,
  });
});

runtimeRoutes.get("/events", (c) => {
  const organizationId = c.get("organizationId")!;
  return c.json({ events: queue.recent(organizationId).slice(-50) });
});
