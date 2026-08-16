import { Hono } from "hono";
import {
  computeHealthScore,
  otlpToEnvelope,
  redactHeaders,
  redactJson,
  type RedactionRule,
  type TelemetryEnvelope,
} from "@strim/shared";
import type { AppEnv } from "../types";
import { apiKeyAuth, requireScope } from "../middleware/api-key";
import { queue } from "../lib/queue";
import { writeAudit } from "../lib/audit";
import { insertRequestAggregates } from "../lib/clickhouse";

const ingestWindow: number[] = [];
const MAX_RPS = Number(process.env.INGEST_MAX_RPS ?? 2000);

function ingestLoadOk(): boolean {
  const now = Date.now();
  while (ingestWindow.length && ingestWindow[0]! < now - 1000) ingestWindow.shift();
  if (ingestWindow.length >= MAX_RPS) return false;
  ingestWindow.push(now);
  return true;
}

export const ingestRoutes = new Hono<AppEnv>();

ingestRoutes.use("*", apiKeyAuth);

ingestRoutes.post("/v1/ingest", requireScope("telemetry:write"), async (c) => {
  if (!ingestLoadOk()) {
    c.header("retry-after", "1");
    return c.json({ error: "RATE_LIMITED" }, 429);
  }
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "UNAUTHORIZED" }, 401);
  const envelope = (await c.req.json()) as TelemetryEnvelope;
  await queue.enqueue("telemetry.process", { organizationId, envelope });
  await c.get("db").usageEvent.create({
    data: { organizationId, metric: "telemetry_events", quantity: envelope.events?.length ?? 0 },
  });
  return c.json({ accepted: true }, 202);
});

ingestRoutes.post("/v1/otlp/v1/traces", requireScope("telemetry:write"), async (c) => {
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "UNAUTHORIZED" }, 401);
  const body = (await c.req.json()) as {
    projectId?: string;
    environment?: string;
    resourceSpans: { scopeSpans: { spans: never[] }[] }[];
  };
  const envelope = otlpToEnvelope({
    projectId: body.projectId ?? "unknown",
    environment: body.environment ?? "production",
    resourceSpans: body.resourceSpans,
  });
  await queue.enqueue("telemetry.process", { organizationId, envelope });
  return c.json({ accepted: true }, 202);
});

export async function registerTelemetryWorker(db: AppEnv["Variables"]["db"]): Promise<void> {
  queue.process("telemetry.process", async (job: { organizationId: string; envelope: TelemetryEnvelope }) => {
    const { organizationId, envelope } = job;
    const env = await db.environment.findFirst({
      where: {
        organizationId,
        name: { equals: envelope.environment, mode: "insensitive" },
      },
      include: { redactionRules: true, application: true },
    });
    if (!env) return;
    const extra: RedactionRule[] = env.redactionRules.map((r) => ({
      name: r.name,
      pattern: r.pattern,
      flags: r.flags,
    }));
    const durations: number[] = [];
    let errors = 0;
    for (const event of envelope.events ?? []) {
      if (event.type !== "request" && event.type !== "span") continue;
      const headers = redactHeaders(event.headers ?? {}, extra);
      const body = redactJson(event.body, extra);
      const duration = event.durationMs ?? 0;
      durations.push(duration);
      const status = event.status ?? 200;
      if (status >= 500) errors += 1;
      await db.requestRecord.create({
        data: {
          organizationId,
          environmentId: env.id,
          requestId: event.requestId ?? crypto.randomUUID(),
          traceId: event.traceId ?? crypto.randomUUID(),
          method: event.method ?? "GET",
          path: event.path ?? "/",
          status,
          durationMs: duration,
          region: event.region,
          service: event.service ?? env.application.name,
          headers: headers as object,
          payloadRef: body ? "redacted-inline" : undefined,
        },
      });
      if (event.service && event.service !== env.application.name) {
        await db.topologyNode.upsert({
          where: { environmentId_name: { environmentId: env.id, name: event.service } },
          create: {
            organizationId,
            environmentId: env.id,
            name: event.service,
            kind: "service",
          },
          update: {},
        });
        await db.topologyNode.upsert({
          where: { environmentId_name: { environmentId: env.id, name: env.application.name } },
          create: {
            organizationId,
            environmentId: env.id,
            name: env.application.name,
            kind: "service",
          },
          update: {},
        });
        await db.topologyEdge.upsert({
          where: {
            environmentId_fromName_toName: {
              environmentId: env.id,
              fromName: env.application.name,
              toName: event.service,
            },
          },
          create: {
            organizationId,
            environmentId: env.id,
            fromName: env.application.name,
            toName: event.service,
          },
          update: {},
        });
      }
      if (status >= 500) {
        queue.publish("ERROR_DETECTED", { organizationId, environmentId: env.id, path: event.path });
      }
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;
    const errorRate = durations.length ? errors / durations.length : 0;
    const rps = durations.length;
    const health = computeHealthScore({
      errorRate,
      availability: 1 - errorRate,
      p95Ms: p95,
      rps,
    });
    await db.runtimeHealthSnapshot.create({
      data: {
        organizationId,
        environmentId: env.id,
        score: health.score,
        breakdown: health.breakdown,
        rps,
        p95Ms: p95,
        p99Ms: p99,
        errorRate,
      },
    });
    await insertRequestAggregates([
      { organizationId, environmentId: env.id, rps, p95, p99, errorRate, ts: Date.now() },
    ]);
    queue.publish("REQUEST_COMPLETED", { organizationId, environmentId: env.id, health });
    void writeAudit;
  });
}
