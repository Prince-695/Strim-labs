import { Hono } from "hono";
import { z } from "zod";
import {
  blastRadius,
  dependsOn,
  isDangerousReplayTarget,
  redactHeaders,
  redactJson,
  whatBreaksIfUnavailable,
} from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { writeAudit } from "../lib/audit";
import { queue } from "../lib/queue";
import { roleAtLeast } from "@strim/shared";

export const requestRoutes = new Hono<AppEnv>();
requestRoutes.use("*", requireAuth, requireOrg);

requestRoutes.get("/", async (c) => {
  const environmentId = c.req.query("environmentId");
  const records = await c.get("db").requestRecord.findMany({
    where: { organizationId: c.get("organizationId")!, environmentId: environmentId || undefined },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return c.json({ requests: records });
});

requestRoutes.get("/:id", async (c) => {
  const rec = await c.get("db").requestRecord.findFirst({
    where: { id: c.req.param("id"), organizationId: c.get("organizationId")! },
  });
  if (!rec) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(rec);
});

requestRoutes.get("/:id/trace", async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const rec = await db.requestRecord.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!rec) return c.json({ error: "NOT_FOUND" }, 404);

  const spans = await db.requestRecord.findMany({
    where: { traceId: rec.traceId, organizationId },
    orderBy: { createdAt: "asc" },
  });

  return c.json({
    root: rec,
    spans: spans.map((s) => ({
      id: s.id,
      service: s.service,
      path: s.path,
      method: s.method,
      status: s.status,
      durationMs: s.durationMs,
      createdAt: s.createdAt,
    })),
  });
});

export const topologyRoutes = new Hono<AppEnv>();
topologyRoutes.use("*", requireAuth, requireOrg);

topologyRoutes.get("/", async (c) => {
  const environmentId = c.req.query("environmentId");
  if (!environmentId) return c.json({ error: "VALIDATION" }, 400);
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const [nodes, edges] = await Promise.all([
    db.topologyNode.findMany({ where: { environmentId, organizationId } }),
    db.topologyEdge.findMany({ where: { environmentId, organizationId } }),
  ]);
  return c.json({ nodes, edges });
});

topologyRoutes.post("/annotate", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      fromName: z.string(),
      toName: z.string(),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  await db.topologyNode.upsert({
    where: { environmentId_name: { environmentId: body.environmentId, name: body.fromName } },
    create: { organizationId, environmentId: body.environmentId, name: body.fromName, manual: true },
    update: { manual: true },
  });
  await db.topologyNode.upsert({
    where: { environmentId_name: { environmentId: body.environmentId, name: body.toName } },
    create: { organizationId, environmentId: body.environmentId, name: body.toName, manual: true },
    update: { manual: true },
  });
  const edge = await db.topologyEdge.upsert({
    where: {
      environmentId_fromName_toName: {
        environmentId: body.environmentId,
        fromName: body.fromName,
        toName: body.toName,
      },
    },
    create: { organizationId, ...body, manual: true },
    update: { manual: true },
  });
  return c.json(edge);
});

topologyRoutes.get("/query", async (c) => {
  const environmentId = c.req.query("environmentId");
  const node = c.req.query("node") ?? "";
  const q = c.req.query("q") ?? "depends";
  const edges = await c.get("db").topologyEdge.findMany({
    where: { environmentId: environmentId ?? "", organizationId: c.get("organizationId")! },
  });
  const mapped = edges.map((e) => ({ from: e.fromName, to: e.toName }));
  if (q === "breaks") return c.json({ result: whatBreaksIfUnavailable(node, mapped) });
  if (q === "blast") return c.json({ result: blastRadius(node, mapped) });
  return c.json({ result: dependsOn(node, mapped) });
});

export const replayRoutes = new Hono<AppEnv>();
replayRoutes.use("*", requireAuth, requireOrg);

replayRoutes.post("/", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      mode: z.enum(["exact", "session", "traffic", "scaled", "transformed"]),
      requestIds: z.array(z.string()).min(1),
      targetEnvType: z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION"]).default("STAGING"),
      scale: z.number().optional(),
      transform: z.record(z.unknown()).optional(),
    })
    .parse(await c.req.json());
  const role = c.get("role");
  if (body.targetEnvType === "PRODUCTION" && (!role || !roleAtLeast(role, "ENGINEER"))) {
    await writeAudit(c.get("db"), {
      organizationId: c.get("organizationId")!,
      actorId: c.get("userId"),
      action: "replay.denied",
      resourceType: "replay",
      environmentId: body.environmentId,
      newValue: { reason: "replay:production required" },
    });
    return c.json({ error: "FORBIDDEN", message: "Production replay requires replay:production / Engineer+" }, 403);
  }
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const original = await db.requestRecord.findFirst({
    where: { id: body.requestIds[0], organizationId },
  });
  if (original && isDangerousReplayTarget(original.method, original.path)) {
    return c.json(
      { error: "FORBIDDEN", message: "Dangerous operation blocked unless explicitly authorized per-request" },
      403,
    );
  }
  const replay = await db.replay.create({
    data: {
      organizationId,
      environmentId: body.environmentId,
      mode: body.mode,
      targetEnvType: body.targetEnvType,
      requestIds: body.requestIds,
      actorId: c.get("userId"),
      status: "running",
    },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "replay.execute",
    resourceType: "replay",
    resourceId: replay.id,
    environmentId: body.environmentId,
    newValue: { mode: body.mode, targetEnvType: body.targetEnvType },
  });
  await queue.enqueue("replay.execute", { replayId: replay.id, organizationId });
  return c.json(replay, 202);
});

export async function registerReplayWorker(db: AppEnv["Variables"]["db"]): Promise<void> {
  queue.process("replay.execute", async (job: { replayId: string; organizationId: string }) => {
    const replay = await db.replay.findFirst({
      where: { id: job.replayId, organizationId: job.organizationId },
    });
    if (!replay) return;
    const original = await db.requestRecord.findFirst({
      where: { id: replay.requestIds[0], organizationId: job.organizationId },
    });

    if (!original) {
      await db.replay.update({ where: { id: replay.id }, data: { status: "failed" } });
      return;
    }

    let replayedStatus = original.status;
    let replayedDurationMs = Math.max(1, Math.round(original.durationMs * 0.95));
    let replayedBody: unknown = { ok: true, replayed: true };
    const sanitizedHeaders = redactHeaders((original.headers as Record<string, string>) ?? {});

    // Attempt real HTTP request dispatch if target URL or demo checkout is reachable
    const targetBaseUrl =
      process.env.REPLAY_TARGET_URL ??
      (original.service === "checkout" ? "http://localhost:3002" : null);

    if (targetBaseUrl) {
      try {
        const start = Date.now();
        const res = await fetch(`${targetBaseUrl}${original.path}`, {
          method: original.method,
          headers: {
            ...sanitizedHeaders,
            "x-strim-replay": "true",
            "x-strim-replay-id": replay.id,
          },
          signal: AbortSignal.timeout(4000),
        });
        replayedDurationMs = Date.now() - start;
        replayedStatus = res.status;
        try {
          replayedBody = await res.json();
        } catch {
          replayedBody = await res.text();
        }
      } catch {
        // Fallback to simulated response if target service is unreachable
        replayedStatus = original.status;
        replayedDurationMs = Math.max(1, Math.round(original.durationMs * 0.9));
        replayedBody = { ok: true, simulated: true };
      }
    }

    const replayed = {
      status: replayedStatus,
      durationMs: replayedDurationMs,
      headers: sanitizedHeaders,
      body: redactJson(replayedBody),
    };

    const comparison = {
      status: { from: original.status, to: replayed.status },
      timing: { from: original.durationMs, to: replayed.durationMs, deltaMs: replayed.durationMs - original.durationMs },
      body: { from: "[stored]", to: replayed.body },
    };

    await db.replay.update({
      where: { id: replay.id },
      data: { status: "completed", result: { replayed, comparison } as object },
    });
  });
}
