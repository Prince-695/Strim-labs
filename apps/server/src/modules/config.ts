import { Hono } from "hono";
import { z } from "zod";
import { diffRuntimeState, formatDiffLine, recommendCache } from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { requireProductionTier } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { queue } from "../lib/queue";
import { queryCacheStats } from "../lib/clickhouse";

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

configRoutes.get("/:key", async (c) => {
  const key = c.req.param("key");
  const environmentId = c.req.query("environmentId");
  if (!environmentId) return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);

  const config = await c.get("db").configuration.findUnique({
    where: { environmentId_key: { environmentId, key } },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!config || config.organizationId !== c.get("organizationId")) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }
  return c.json({ configuration: config });
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
  queue.publish("CONFIG_CHANGED", { organizationId, environmentId: body.environmentId, key: body.key, values });
  return c.json({ configuration: config, runtimeVersion: version });
});

configRoutes.delete("/:key", requireProductionTier(), async (c) => {
  const key = c.req.param("key");
  const environmentId = c.req.query("environmentId");
  const reason = c.req.query("reason") ?? "Deleted via API";
  if (!environmentId) return c.json({ error: "VALIDATION", message: "environmentId required" }, 400);

  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const env = await db.environment.findFirst({ where: { id: environmentId, organizationId } });
  if (!env) return c.json({ error: "NOT_FOUND" }, 404);

  const existing = await db.configuration.findUnique({
    where: { environmentId_key: { environmentId, key } },
  });
  if (!existing || existing.organizationId !== organizationId) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  await db.configurationVersion.create({
    data: {
      configurationId: existing.id,
      actorId: c.get("userId"),
      reason,
      oldValue: existing.value as object,
      newValue: null as unknown as object,
    },
  });

  await db.configuration.delete({
    where: { id: existing.id },
  });

  const all = await db.configuration.findMany({ where: { environmentId } });
  const values = Object.fromEntries(all.map((x) => [x.key, x.value]));
  const last = await db.runtimeVersion.findFirst({
    where: { environmentId },
    orderBy: { seq: "desc" },
  });
  const version = await db.runtimeVersion.create({
    data: {
      organizationId,
      environmentId,
      seq: (last?.seq ?? 0) + 1,
      values: values as object,
      approved: true,
    },
  });

  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "configuration.delete",
    resourceType: "configuration",
    resourceId: existing.id,
    environmentId,
    oldValue: existing.value,
    newValue: null,
  });

  queue.publish("CONFIG_CHANGED", { organizationId, environmentId, key, values });
  return c.json({ ok: true, deletedKey: key, runtimeVersion: version });
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

sdkConfigRoutes.get("/v1/sdk/config/stream", async (c) => {
  const organizationId = c.get("organizationId");
  const project = c.req.header("x-strim-project") || c.req.query("project");
  const envName = c.req.header("x-strim-environment") || c.req.query("environment");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          const parsed = JSON.parse(data) as {
            topic?: string;
            payload?: { organizationId?: string; environmentId?: string; values?: Record<string, unknown> };
          };
          if (organizationId && parsed.payload?.organizationId && parsed.payload.organizationId !== organizationId) {
            return;
          }
          if (parsed.topic === "CONFIG_CHANGED" || parsed.topic === "CHANGE_PLAN_ROLLOUT") {
            controller.enqueue(encoder.encode(`event: config\ndata: ${JSON.stringify(parsed.payload)}\n\n`));
          }
        } catch {
          // ignore parsing error
        }
      };
      const unsub = queue.subscribe(send);
      const ping = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), 15000);
      return () => {
        unsub();
        clearInterval(ping);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
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

cacheRoutes.patch("/rules/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      endpoint: z.string().optional(),
      method: z.string().optional(),
      ttlSeconds: z.number().optional(),
      enabled: z.boolean().optional(),
      tags: z.array(z.string()).optional(),
    })
    .parse(await c.req.json());

  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const existing = await db.cacheRule.findFirst({ where: { id, organizationId } });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const updated = await db.cacheRule.update({
    where: { id },
    data: body,
  });

  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "cache_rule.update",
    resourceType: "cache_rule",
    resourceId: id,
    environmentId: existing.environmentId,
    oldValue: existing,
    newValue: updated,
  });

  return c.json(updated);
});

cacheRoutes.delete("/rules/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const existing = await db.cacheRule.findFirst({ where: { id, organizationId } });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await db.cacheRule.delete({ where: { id } });

  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "cache_rule.delete",
    resourceType: "cache_rule",
    resourceId: id,
    environmentId: existing.environmentId,
    oldValue: existing,
  });

  return c.json({ ok: true });
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
  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const stats = await queryCacheStats(db, {
    organizationId,
    environmentId: environmentId || "",
  });

  return c.json(stats);
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

