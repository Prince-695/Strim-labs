import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types";

const telemetryEventSchema = z.object({
  timestamp: z.number().optional(),
  method: z.string().default("GET"),
  path: z.string().default("/"),
  statusCode: z.number().default(200),
  durationMs: z.number().default(0),
  userAgent: z.string().optional(),
});

const ingestBatchSchema = z.object({
  events: z.array(telemetryEventSchema).min(1, "At least one telemetry event is required"),
  sentAt: z.number().optional(),
});

export const ingestRoutes = new Hono<AppEnv>();

/**
 * Health / Verification ping for onboarding wizard
 */
ingestRoutes.get("/ping", (c) => {
  return c.json({ ok: true, service: "strim-ingestion-gateway" });
});

/**
 * Ingest telemetry batch from @strim/sdk
 */
ingestRoutes.post("/", zValidator("json", ingestBatchSchema), async (c) => {
  const authHeader = c.req.header("authorization");
  const strimHeader = c.req.header("x-strim-key");
  const apiKey = strimHeader || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!apiKey || !apiKey.startsWith("strim_")) {
    return c.json({ error: "UNAUTHORIZED", message: "Missing or invalid x-strim-key header" }, 401);
  }

  const db = c.get("db");
  const project = await db.project.findUnique({
    where: { apiKey },
    select: { id: true, name: true, status: true, organizationId: true },
  });

  if (!project) {
    return c.json({ error: "UNAUTHORIZED", message: "No project found matching this API key" }, 401);
  }

  const { events } = c.req.valid("json");

  let successCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  const durations: number[] = [];

  // Group events by route for efficient database operations
  const routeAggregates = new Map<
    string,
    { method: string; path: string; totalCalls: number; errorCalls: number; totalDuration: number; latestTimestamp: number }
  >();

  for (const ev of events) {
    const method = (ev.method || "GET").toUpperCase();
    const rawPath = ev.path || "/";
    const cleanPath = (rawPath.split("?")[0] || "/").split("#")[0]?.replace(/\/+$/, "") || "/";
    const normalizedPath = cleanPath === "" ? "/" : cleanPath;
    const isError = ev.statusCode >= 500;
    const isWarning = ev.statusCode >= 400 && ev.statusCode < 500;
    const isSuccess = ev.statusCode >= 200 && ev.statusCode < 400;

    if (isSuccess) successCount++;
    else if (isWarning) warningCount++;
    else if (isError) errorCount++;

    durations.push(ev.durationMs);

    const key = `${method}::${normalizedPath}`;
    const agg = routeAggregates.get(key) || {
      method,
      path: normalizedPath,
      totalCalls: 0,
      errorCalls: 0,
      totalDuration: 0,
      latestTimestamp: ev.timestamp || Date.now(),
    };

    agg.totalCalls++;
    if (isError || isWarning) agg.errorCalls++;
    agg.totalDuration += ev.durationMs;
    agg.latestTimestamp = Math.max(agg.latestTimestamp, ev.timestamp || Date.now());
    routeAggregates.set(key, agg);
  }

  // Calculate percentiles
  durations.sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
  const p99 = durations[Math.floor(durations.length * 0.99)] ?? 0;

  // Process route discoveries asynchronously to keep ingestion ultra fast
  for (const agg of routeAggregates.values()) {
    const avgDuration = Math.round(agg.totalDuration / agg.totalCalls);

    try {
      await db.discoveredRoute.upsert({
        where: {
          projectId_method_path: {
            projectId: project.id,
            method: agg.method,
            path: agg.path,
          },
        },
        create: {
          projectId: project.id,
          method: agg.method,
          path: agg.path,
          totalCalls: agg.totalCalls,
          errorCalls: agg.errorCalls,
          avgDurationMs: avgDuration,
          p95DurationMs: avgDuration,
          lastSeenAt: new Date(agg.latestTimestamp),
        },
        update: {
          totalCalls: { increment: agg.totalCalls },
          errorCalls: { increment: agg.errorCalls },
          avgDurationMs: avgDuration,
          p95DurationMs: avgDuration,
          lastSeenAt: new Date(agg.latestTimestamp),
        },
      });
    } catch {
      // Ignore conflict race conditions gracefully
    }
  }

  // Record rolling telemetry metric bucket
  const bucketTime = new Date(Math.floor(Date.now() / 60000) * 60000);
  try {
    await db.telemetryMetric.create({
      data: {
        projectId: project.id,
        timestamp: bucketTime,
        totalRequests: events.length,
        successCount,
        warningCount,
        errorCount,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
      },
    });
  } catch {
    // Non-critical telemetry logging failure
  }

  // Update project status if this is the first ping (activate from PENDING_SDK)
  let updatedStatus = project.status;
  if (project.status === "PENDING_SDK") {
    updatedStatus = "ACTIVE";
    await db.project.update({
      where: { id: project.id },
      data: { status: "ACTIVE" },
    });
  } else if (events.length > 5) {
    const errorRatio = errorCount / events.length;
    if (errorRatio > 0.4) {
      updatedStatus = "INCIDENT";
    } else if (errorRatio > 0.15) {
      updatedStatus = "DEGRADED";
    } else {
      updatedStatus = "ACTIVE";
    }
    if (updatedStatus !== project.status) {
      await db.project.update({
        where: { id: project.id },
        data: { status: updatedStatus },
      });
    }
  }

  return c.json({
    ok: true,
    ingested: events.length,
    projectId: project.id,
    projectStatus: updatedStatus,
    timestamp: Date.now(),
  });
});
