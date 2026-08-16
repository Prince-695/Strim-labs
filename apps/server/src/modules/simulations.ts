import { Hono } from "hono";
import { z } from "zod";
import { analyzeBreakingPoint, compareRuns, modelWhatIf } from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { writeAudit } from "../lib/audit";
import { queue } from "../lib/queue";

const baselineMetrics = {
  p95Ms: 420,
  p99Ms: 800,
  errorRate: 0.02,
  originRps: 120,
  cacheHitRate: 0,
};

export const simulationRoutes = new Hono<AppEnv>();
simulationRoutes.use("*", requireAuth, requireOrg);

simulationRoutes.post("/", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      name: z.string().optional(),
      change: z.object({
        kind: z.enum(["traffic", "cache", "timeout", "dependencyLatency", "dependencyUnavailable"]),
        multiplier: z.number().optional(),
        enabled: z.boolean().optional(),
        fromMs: z.number().optional(),
        toMs: z.number().optional(),
        factor: z.number().optional(),
        dependency: z.string().optional(),
      }),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const env = await db.environment.findFirst({ where: { id: body.environmentId, organizationId } });
  if (!env) return c.json({ error: "NOT_FOUND" }, 404);
  if (env.type === "PRODUCTION") {
    return c.json({ error: "FORBIDDEN", message: "Simulations must not mutate production runtime state" }, 403);
  }
  const sim = await db.simulation.create({
    data: { organizationId, environmentId: body.environmentId, status: "running" },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "simulation.create",
    resourceType: "simulation",
    resourceId: sim.id,
    environmentId: body.environmentId,
  });
  queue.publish("SIMULATION_STARTED", { organizationId, simulationId: sim.id });
  const change = body.change as Parameters<typeof modelWhatIf>[1];
  const experiment = modelWhatIf(baselineMetrics, change);
  const comparison = compareRuns(baselineMetrics, experiment);
  const updated = await db.simulation.update({
    where: { id: sim.id },
    data: {
      status: "completed",
      baseline: baselineMetrics,
      experiment,
      comparison,
    },
  });
  queue.publish("SIMULATION_COMPLETED", { organizationId, simulationId: sim.id });
  return c.json(updated, 201);
});

simulationRoutes.get("/", async (c) => {
  const simulations = await c.get("db").simulation.findMany({
    where: {
      organizationId: c.get("organizationId")!,
      environmentId: c.req.query("environmentId") || undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return c.json({ simulations });
});

export const loadTestRoutes = new Hono<AppEnv>();
loadTestRoutes.use("*", requireAuth, requireOrg);

loadTestRoutes.post("/", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      kind: z.enum(["load", "stress", "spike", "endurance", "capacity"]),
      targetRps: z.number(),
      durationSeconds: z.number().default(30),
      scale: z.number().default(1),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const snap = await db.trafficSnapshot.findFirst({
    where: { environmentId: body.environmentId, organizationId },
    orderBy: { createdAt: "desc" },
  });
  const dist = (snap?.distribution as { path: string; pct: number }[] | null) ?? [
    { path: "/products", pct: 0.6 },
    { path: "/checkout", pct: 0.3 },
    { path: "/pay", pct: 0.1 },
  ];
  const scaled = dist.map((d) => ({ ...d, rps: d.pct * body.targetRps * body.scale }));
  const samples = [0.5, 1, 1.5, 2, 3].map((m) => {
    const rps = body.targetRps * m;
    return {
      rps,
      errorRate: Math.max(0, (m - 1.2) * 0.04),
      p95Ms: 200 + m * 180,
    };
  });
  const breaking = analyzeBreakingPoint(samples);
  const test = await db.loadTest.create({
    data: {
      organizationId,
      environmentId: body.environmentId,
      kind: body.kind,
      config: body as object,
      status: "completed",
      result: { distribution: scaled, samples },
      breakingPoint: breaking as object,
    },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "load_test.execute",
    resourceType: "load_test",
    resourceId: test.id,
    environmentId: body.environmentId,
  });
  queue.publish("LOAD_TEST_COMPLETED", { organizationId, loadTestId: test.id });
  return c.json(test, 201);
});

loadTestRoutes.get("/", async (c) => {
  const tests = await c.get("db").loadTest.findMany({
    where: { organizationId: c.get("organizationId")! },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return c.json({ loadTests: tests });
});
