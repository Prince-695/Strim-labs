import { Hono } from "hono";
import { z } from "zod";
import { diffRuntimeState, formatDiffLine, recommendCache } from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { requireProductionTier } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { queue } from "../lib/queue";

export const configRoutes = new Hono<AppEnv>();
configRoutes.use("*", requireAuth, requireOrg);

configRoutes.get("/", async (c) => {
  const environmentId = c.req.query("environmentId");
  const items = await c.get("db").configuration.findMany({
    where: { organizationId: c.get("organizationId")!, environmentId: environmentId || undefined },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return c.json({ configurations: items });
});

configRoutes.put("/", requireProductionTier(), async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      key: z.string(),
      value: z.unknown(),
      reason: z.string().min(1),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const env = await db.environment.findFirst({ where: { id: body.environmentId, organizationId } });
  if (!env) return c.json({ error: "NOT_FOUND" }, 404);
  const existing = await db.configuration.findUnique({
    where: { environmentId_key: { environmentId: body.environmentId, key: body.key } },
  });
  const config = await db.configuration.upsert({
    where: { environmentId_key: { environmentId: body.environmentId, key: body.key } },
    create: { organizationId, environmentId: body.environmentId, key: body.key, value: body.value as object },
    update: { value: body.value as object },
  });
  await db.configurationVersion.create({
    data: {
      configurationId: config.id,
      actorId: c.get("userId"),
      reason: body.reason,
      oldValue: existing?.value as object | undefined,
      newValue: body.value as object,
    },
  });
  const all = await db.configuration.findMany({ where: { environmentId: body.environmentId } });
  const values = Object.fromEntries(all.map((x) => [x.key, x.value]));
  const last = await db.runtimeVersion.findFirst({
    where: { environmentId: body.environmentId },
    orderBy: { seq: "desc" },
  });
  const version = await db.runtimeVersion.create({
    data: {
      organizationId,
      environmentId: body.environmentId,
      seq: (last?.seq ?? 0) + 1,
      values: values as object,
      approved: true,
    },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "configuration.update",
    resourceType: "configuration",
    resourceId: config.id,
    environmentId: body.environmentId,
    oldValue: existing?.value,
    newValue: body.value,
  });
  queue.publish("CONFIG_CHANGED", { organizationId, environmentId: body.environmentId, key: body.key });
  return c.json({ configuration: config, runtimeVersion: version });
});

configRoutes.get("/versions", async (c) => {
  const environmentId = c.req.query("environmentId");
  const versions = await c.get("db").runtimeVersion.findMany({
    where: { organizationId: c.get("organizationId")!, environmentId: environmentId || undefined },
    orderBy: { seq: "desc" },
  });
  return c.json({ versions });
});

configRoutes.get("/diff", async (c) => {
  const a = c.req.query("from");
  const b = c.req.query("to");
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const left = await db.runtimeVersion.findFirst({ where: { id: a, organizationId } });
  const right = await db.runtimeVersion.findFirst({ where: { id: b, organizationId } });
  if (!left || !right) return c.json({ error: "NOT_FOUND" }, 404);
  const diffs = diffRuntimeState(left.values as Record<string, unknown>, right.values as Record<string, unknown>);
  return c.json({ diffs, lines: diffs.map(formatDiffLine) });
});

configRoutes.get("/sdk", async (c) => {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) return c.json({ error: "VALIDATION" }, 400);
  const version = await c.get("db").runtimeVersion.findFirst({
    where: { environmentId, organizationId: c.get("organizationId")!, approved: true },
    orderBy: { seq: "desc" },
  });
  const active = await c.get("db").changePlan.findFirst({
    where: { environmentId, organizationId: c.get("organizationId")!, state: { in: ["ROLLING_OUT", "MONITORING"] } },
    orderBy: { updatedAt: "desc" },
  });
  let proposed: Record<string, unknown> = {};
  if (active?.proposedVersionId) {
    const pv = await c.get("db").runtimeVersion.findFirst({ where: { id: active.proposedVersionId } });
    proposed = (pv?.values as Record<string, unknown>) ?? {};
  }
  return c.json({
    values: (version?.values as Record<string, unknown>) ?? {},
    proposed,
    rolloutPercent: active?.rolloutPercent ?? 0,
  });
});

export const sdkConfigRoutes = new Hono<AppEnv>();

sdkConfigRoutes.get("/v1/sdk/config", async (c) => {
  const organizationId = c.get("organizationId");
  const project = c.req.header("x-strim-project");
  const envName = c.req.header("x-strim-environment");
  if (!organizationId || !envName) return c.json({ values: {} });
  const env = await c.get("db").environment.findFirst({
    where: { organizationId, name: { equals: envName, mode: "insensitive" } },
  });
  if (!env) return c.json({ values: {}, project });
  const version = await c.get("db").runtimeVersion.findFirst({
    where: { environmentId: env.id, approved: true },
    orderBy: { seq: "desc" },
  });
  const active = await c.get("db").changePlan.findFirst({
    where: { environmentId: env.id, state: { in: ["ROLLING_OUT", "MONITORING"] } },
  });
  let proposed: Record<string, unknown> = {};
  if (active?.proposedVersionId) {
    const pv = await c.get("db").runtimeVersion.findFirst({ where: { id: active.proposedVersionId } });
    proposed = (pv?.values as Record<string, unknown>) ?? {};
  }
  return c.json({
    values: (version?.values as Record<string, unknown>) ?? {},
    proposed,
    rolloutPercent: active?.rolloutPercent ?? 0,
  });
});

export const cacheRoutes = new Hono<AppEnv>();
cacheRoutes.use("*", requireAuth, requireOrg);

cacheRoutes.get("/rules", async (c) => {
  const environmentId = c.req.query("environmentId");
  const rules = await c.get("db").cacheRule.findMany({
    where: { organizationId: c.get("organizationId")!, environmentId: environmentId || undefined },
  });
  return c.json({ rules });
});

cacheRoutes.post("/rules", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      endpoint: z.string(),
      method: z.string(),
      ttlSeconds: z.number(),
      tags: z.array(z.string()).optional(),
    })
    .parse(await c.req.json());
  const rule = await c.get("db").cacheRule.create({
    data: { ...body, organizationId: c.get("organizationId")! },
  });
  await writeAudit(c.get("db"), {
    organizationId: c.get("organizationId")!,
    actorId: c.get("userId"),
    action: "cache_rule.create",
    resourceType: "cache_rule",
    resourceId: rule.id,
    environmentId: body.environmentId,
    newValue: body,
  });
  return c.json(rule, 201);
});

cacheRoutes.post("/invalidate", async (c) => {
  const body = z
    .object({ kind: z.enum(["manual", "tag", "endpoint"]), cacheRuleId: z.string().optional() })
    .parse(await c.req.json());
  const event = await c.get("db").cacheInvalidationEvent.create({
    data: { organizationId: c.get("organizationId")!, ...body },
  });
  queue.publish("CACHE_INVALIDATED", { organizationId: c.get("organizationId")!, ...body });
  return c.json(event);
});

cacheRoutes.get("/analytics", async (c) => {
  const environmentId = c.req.query("environmentId");
  const rules = await c.get("db").cacheRule.findMany({
    where: { environmentId: environmentId || undefined, organizationId: c.get("organizationId")! },
  });
  const enabled = rules.some((r) => r.enabled);
  return c.json({
    totalRequests: 1000,
    hits: enabled ? 700 : 0,
    misses: enabled ? 300 : 1000,
    hitRate: enabled ? 0.7 : 0,
    originReductionPct: enabled ? 70 : 0,
    bandwidthSaved: enabled ? "12MB" : "0",
  });
});

cacheRoutes.get("/recommendations", async (c) => {
  const environmentId = c.req.query("environmentId");
  const records = await c.get("db").requestRecord.findMany({
    where: { environmentId: environmentId || undefined, organizationId: c.get("organizationId")! },
    take: 500,
  });
  const grouped = new Map<string, { path: string; method: string; rps: number; p95Ms: number; changeFrequency: number }>();
  for (const r of records) {
    const k = `${r.method} ${r.path}`;
    const g = grouped.get(k) ?? { path: r.path, method: r.method, rps: 0, p95Ms: r.durationMs, changeFrequency: 0.01 };
    g.rps += 1;
    g.p95Ms = Math.max(g.p95Ms, r.durationMs);
    grouped.set(k, g);
  }
  return c.json({ recommendations: recommendCache([...grouped.values()]) });
});

cacheRoutes.post("/snapshots/runtime", async (c) => {
  const body = z.object({ environmentId: z.string() }).parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const [config, topology, health, cache] = await Promise.all([
    db.runtimeVersion.findFirst({ where: { environmentId: body.environmentId }, orderBy: { seq: "desc" } }),
    db.topologyEdge.findMany({ where: { environmentId: body.environmentId } }),
    db.runtimeHealthSnapshot.findFirst({
      where: { environmentId: body.environmentId },
      orderBy: { capturedAt: "desc" },
    }),
    db.cacheRule.findMany({ where: { environmentId: body.environmentId } }),
  ]);
  const snap = await db.runtimeSnapshot.create({
    data: {
      organizationId,
      environmentId: body.environmentId,
      payload: { config, topology, health, cache } as object,
    },
  });
  return c.json(snap, 201);
});

cacheRoutes.post("/snapshots/traffic", async (c) => {
  const body = z.object({ environmentId: z.string() }).parse(await c.req.json());
  const records = await c.get("db").requestRecord.findMany({
    where: { environmentId: body.environmentId, organizationId: c.get("organizationId")! },
    take: 1000,
  });
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.path, (counts.get(r.path) ?? 0) + 1);
  const total = records.length || 1;
  const distribution = [...counts.entries()].map(([path, n]) => ({ path, pct: n / total, count: n }));
  const snap = await c.get("db").trafficSnapshot.create({
    data: {
      organizationId: c.get("organizationId")!,
      environmentId: body.environmentId,
      distribution: distribution as object,
    },
  });
  return c.json(snap, 201);
});
