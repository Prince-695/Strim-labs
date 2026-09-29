import type { PrismaClient } from "@prisma/client";

export type RequestAggregateRow = {
  organizationId: string;
  environmentId: string;
  service: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  cacheHit?: boolean;
  bytesIn?: number;
  bytesOut?: number;
  timestamp?: Date;
};

export type AggregateMetrics = {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  rps: number;
  totalRequests: number;
};

export type TimeseriesPoint = {
  timestamp: string;
  rps: number;
  p95Ms: number;
  errorRate: number;
};

let clickHouseInitialized = false;

async function ensureClickHouseSchema(): Promise<boolean> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return false;
  if (clickHouseInitialized) return true;

  const database = process.env.CLICKHOUSE_DATABASE ?? "strim";
  try {
    await fetch(`${url}/?query=${encodeURIComponent(`CREATE DATABASE IF NOT EXISTS ${database}`)}`, {
      method: "POST",
    });
    await fetch(
      `${url}/?query=${encodeURIComponent(`
      CREATE TABLE IF NOT EXISTS ${database}.request_aggregates (
        organization_id String,
        environment_id String,
        service String,
        endpoint String,
        method LowCardinality(String),
        status_code UInt16,
        duration_ms Float32,
        cache_hit UInt8,
        bytes_in UInt32,
        bytes_out UInt32,
        timestamp DateTime64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(timestamp)
      ORDER BY (organization_id, environment_id, service, toUnixTimestamp64Milli(timestamp));
    `)}`,
      { method: "POST" },
    );
    clickHouseInitialized = true;
    return true;
  } catch {
    return false;
  }
}

export async function insertRequestAggregates(
  db: PrismaClient,
  rows: RequestAggregateRow[],
): Promise<void> {
  if (rows.length === 0) return;

  const url = process.env.CLICKHOUSE_URL;
  const isChReady = await ensureClickHouseSchema();

  if (url && isChReady) {
    try {
      const database = process.env.CLICKHOUSE_DATABASE ?? "strim";
      const body = rows
        .map((r) =>
          JSON.stringify({
            organization_id: r.organizationId,
            environment_id: r.environmentId,
            service: r.service,
            endpoint: r.endpoint,
            method: r.method,
            status_code: r.statusCode,
            duration_ms: r.durationMs,
            cache_hit: r.cacheHit ? 1 : 0,
            bytes_in: r.bytesIn ?? 0,
            bytes_out: r.bytesOut ?? 0,
            timestamp: (r.timestamp ?? new Date()).toISOString().replace("T", " ").replace("Z", ""),
          }),
        )
        .join("\n");

      const res = await fetch(`${url}/?query=INSERT+INTO+${database}.request_aggregates+FORMAT+JSONEachRow`, {
        method: "POST",
        body,
      });
      if (res.ok) return;
    } catch {
      // Fallback to PostgreSQL
    }
  }

  // PostgreSQL fallback (for Render or single-server deployment without ClickHouse)
  try {
    await db.requestAggregate.createMany({
      data: rows.map((r) => ({
        organizationId: r.organizationId,
        environmentId: r.environmentId,
        service: r.service,
        endpoint: r.endpoint,
        method: r.method,
        statusCode: r.statusCode,
        durationMs: r.durationMs,
        cacheHit: Boolean(r.cacheHit),
        bytesIn: r.bytesIn ?? 0,
        bytesOut: r.bytesOut ?? 0,
        timestamp: r.timestamp ?? new Date(),
      })),
    });
  } catch (err) {
    console.error("[Analytics] Error writing aggregates to DB fallback:", err);
  }
}

export async function queryMetrics(
  db: PrismaClient,
  params: { organizationId: string; environmentId: string; minutesBack?: number },
): Promise<AggregateMetrics> {
  const minutes = params.minutesBack ?? 15;
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  // Read from PostgreSQL fallback table
  const rows = await db.requestAggregate.findMany({
    where: {
      organizationId: params.organizationId,
      environmentId: params.environmentId,
      timestamp: { gte: cutoff },
    },
    select: {
      durationMs: true,
      statusCode: true,
    },
    orderBy: { durationMs: "asc" },
  });

  if (rows.length === 0) {
    return {
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      errorRate: 0,
      rps: 0,
      totalRequests: 0,
    };
  }

  const durations = rows.map((r) => r.durationMs);
  const p50Idx = Math.floor(durations.length * 0.5);
  const p95Idx = Math.floor(durations.length * 0.95);
  const p99Idx = Math.floor(durations.length * 0.99);

  const errors = rows.filter((r) => r.statusCode >= 500).length;
  const durationSeconds = Math.max(1, minutes * 60);

  return {
    p50Ms: Math.round(durations[p50Idx] ?? 0),
    p95Ms: Math.round(durations[p95Idx] ?? 0),
    p99Ms: Math.round(durations[p99Idx] ?? 0),
    errorRate: Number((errors / rows.length).toFixed(4)),
    rps: Number((rows.length / durationSeconds).toFixed(2)),
    totalRequests: rows.length,
  };
}

export async function queryTimeseries(
  db: PrismaClient,
  params: { organizationId: string; environmentId: string; minutesBack?: number; buckets?: number },
): Promise<TimeseriesPoint[]> {
  const minutes = params.minutesBack ?? 60;
  const numBuckets = params.buckets ?? 12;
  const now = Date.now();
  const startTime = now - minutes * 60 * 1000;
  const bucketDurationMs = (minutes * 60 * 1000) / numBuckets;

  const rows = await db.requestAggregate.findMany({
    where: {
      organizationId: params.organizationId,
      environmentId: params.environmentId,
      timestamp: { gte: new Date(startTime) },
    },
    select: {
      durationMs: true,
      statusCode: true,
      timestamp: true,
    },
  });

  const points: TimeseriesPoint[] = [];
  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = startTime + i * bucketDurationMs;
    const bucketEnd = bucketStart + bucketDurationMs;
    const inBucket = rows.filter(
      (r) => r.timestamp.getTime() >= bucketStart && r.timestamp.getTime() < bucketEnd,
    );

    const bucketSeconds = bucketDurationMs / 1000;
    const rps = Number((inBucket.length / bucketSeconds).toFixed(2));
    const errors = inBucket.filter((r) => r.statusCode >= 500).length;
    const errorRate = inBucket.length ? Number((errors / inBucket.length).toFixed(4)) : 0;

    const sortedDurations = inBucket.map((r) => r.durationMs).sort((a, b) => a - b);
    const p95Idx = Math.floor(sortedDurations.length * 0.95);
    const p95Ms = sortedDurations[p95Idx] ?? 0;

    points.push({
      timestamp: new Date(bucketStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      rps,
      p95Ms: Math.round(p95Ms),
      errorRate,
    });
  }

  return points;
}

export async function queryCacheStats(
  db: PrismaClient,
  params: { organizationId: string; environmentId: string },
) {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db.requestAggregate.findMany({
    where: {
      organizationId: params.organizationId,
      environmentId: params.environmentId,
      timestamp: { gte: cutoff },
    },
    select: {
      cacheHit: true,
      bytesOut: true,
    },
  });

  const total = rows.length;
  const hits = rows.filter((r) => r.cacheHit).length;
  const misses = total - hits;
  const hitRate = total ? Number((hits / total).toFixed(2)) : 0;
  const originReductionPct = Math.round(hitRate * 100);
  const totalBytesSaved = rows.filter((r) => r.cacheHit).reduce((acc, r) => acc + (r.bytesOut || 2048), 0);
  const bandwidthSaved =
    totalBytesSaved > 1024 * 1024
      ? `${(totalBytesSaved / (1024 * 1024)).toFixed(1)}MB`
      : `${Math.round(totalBytesSaved / 1024)}KB`;

  return {
    totalRequests: total,
    hits,
    misses,
    hitRate,
    originReductionPct,
    bandwidthSaved,
  };
}
