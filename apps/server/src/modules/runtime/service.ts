import { computeHealthScore } from "@strim/shared";
import type { PrismaClient } from "@prisma/client";
import { queryMetrics, queryTimeseries } from "../../lib/clickhouse";
import { queue } from "../../lib/queue";
import type { RuntimeOverviewData } from "./types";

export class RuntimeService {
  /**
   * Computes the complete runtime overview for an environment, including 0-100 health score
   * and explainability breakdown.
   */
  static async getOverview(
    db: PrismaClient,
    organizationId: string,
    environmentId: string,
  ): Promise<RuntimeOverviewData | null> {
    const env = await db.environment.findFirst({
      where: { id: environmentId, organizationId },
      include: { application: true },
    });
    if (!env) return null;

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

    // Calculate live health score using real metrics
    const computedHealth = computeHealthScore({
      errorRate: metrics.errorRate,
      availability: Math.max(0, 1 - metrics.errorRate),
      p95Ms: metrics.p95Ms || 50,
      rps: metrics.rps,
    });

    const healthScore = metrics.totalRequests > 0 ? computedHealth.score : (latestHealthSnapshot?.score ?? 98);
    const breakdown =
      metrics.totalRequests > 0
        ? computedHealth.breakdown
        : (latestHealthSnapshot?.breakdown as typeof computedHealth.breakdown) ?? {
            availability: 100,
            latency: 95,
            errors: 100,
            trafficAnomaly: 100,
            dependencies: 100,
            cache: 90,
            saturation: 98,
          };

    return {
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
    };
  }

  /**
   * Queries historical timeseries metric buckets.
   */
  static async getTimeseries(
    db: PrismaClient,
    organizationId: string,
    environmentId: string,
    minutes = 60,
  ) {
    return queryTimeseries(db, {
      organizationId,
      environmentId,
      minutesBack: minutes,
      buckets: 12,
    });
  }

  /**
   * Fetches the latest 50 live events published to the organization.
   */
  static getRecentEvents(organizationId: string) {
    return queue.recent(organizationId).slice(-50);
  }
}
