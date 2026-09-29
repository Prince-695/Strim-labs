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
import { insertRequestAggregates, type RequestAggregateRow } from "../lib/clickhouse";
import { rateLimit } from "../lib/redis";
import { storePayload } from "../lib/storage";

const MAX_RPS = Number(process.env.INGEST_MAX_RPS ?? 2000);

export const ingestRoutes = new Hono<AppEnv>();
ingestRoutes.use("*", apiKeyAuth);

ingestRoutes.post("/v1/ingest", requireScope("telemetry:write"), async (c) => {
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const rl = await rateLimit(`ingest:${organizationId}`, MAX_RPS, 1);
  if (!rl.allowed) {
    c.header("retry-after", "1");
    return c.json({ error: "RATE_LIMITED", message: "Telemetry ingestion rate limit exceeded" }, 429);
  }

  const envelope = (await c.req.json()) as TelemetryEnvelope;
  await queue.enqueue("telemetry.process", { organizationId, envelope });

  await c.get("db").usageEvent.create({
    data: { organizationId, metric: "telemetry_events", quantity: envelope.events?.length ?? 1 },
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

    const requestRecordsToCreate = [];
    const aggregatesToInsert: RequestAggregateRow[] = [];

    for (const event of envelope.events ?? []) {
      if (event.type !== "request" && event.type !== "span") continue;

      const headers = redactHeaders(event.headers ?? {}, extra);
      const body = redactJson(event.body, extra);
      const duration = event.durationMs ?? 0;
      durations.push(duration);

      const status = event.status ?? 200;
      if (status >= 500) errors += 1;

      const reqId = event.requestId ?? crypto.randomUUID();
      let payloadRef: string | undefined = undefined;

      if (body) {
        try {
          payloadRef = await storePayload(`payloads/${organizationId}/${env.id}/${reqId}.json`, body as Record<string, unknown>);
        } catch {
          payloadRef = "inline-fallback";
        }
      }

      requestRecordsToCreate.push({
        organizationId,
        environmentId: env.id,
        requestId: reqId,
        traceId: event.traceId ?? crypto.randomUUID(),
        method: event.method ?? "GET",
        path: event.path ?? "/",
        status,
        durationMs: duration,
        region: event.region,
        service: event.service ?? env.application.name,
        headers: headers as object,
        payloadRef,
      });

      aggregatesToInsert.push({
        organizationId,
        environmentId: env.id,
        service: event.service ?? env.application.name,
        endpoint: event.path ?? "/",
        method: event.method ?? "GET",
        statusCode: status,
        durationMs: duration,
        cacheHit: Boolean(event.headers && ("x-cache" in event.headers || "cache-hit" in event.headers)),
        bytesIn: 0,
        bytesOut: 0,
        timestamp: new Date(),
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

    // Batch insert request records to PostgreSQL
    if (requestRecordsToCreate.length > 0) {
      await db.requestRecord.createMany({ data: requestRecordsToCreate });
    }

    // Insert analytics aggregates into ClickHouse / Postgres fallback
    if (aggregatesToInsert.length > 0) {
      await insertRequestAggregates(db, aggregatesToInsert);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;
    const errorRate = durations.length ? errors / durations.length : 0;
    const rps = durations.length;

    const health = computeHealthScore({
      errorRate,
      availability: Math.max(0, 1 - errorRate),
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

    queue.publish("REQUEST_COMPLETED", { organizationId, environmentId: env.id, health });
  });
}
