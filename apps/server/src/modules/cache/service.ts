import { recommendCache } from "@strim/shared";
import type { PrismaClient } from "@prisma/client";
import { writeAudit } from "../../lib/audit";
import { queue } from "../../lib/queue";
import { queryCacheStats } from "../../lib/clickhouse";
import type { CreateCacheRuleInput, InvalidateCacheInput, UpdateCacheRuleInput } from "./types";

export class CacheService {
  /**
   * Lists cache rules for an environment.
   */
  static async listRules(db: PrismaClient, organizationId: string, environmentId?: string) {
    return db.cacheRule.findMany({
      where: {
        organizationId,
        environmentId: environmentId || undefined,
      },
      orderBy: { endpoint: "asc" },
    });
  }

  /**
   * Creates a new cache rule and logs audit.
   */
  static async createRule(
    db: PrismaClient,
    organizationId: string,
    actorId: string | undefined,
    input: CreateCacheRuleInput,
  ) {
    const rule = await db.cacheRule.create({
      data: {
        ...input,
        organizationId,
      },
    });

    await writeAudit(db, {
      organizationId,
      actorId,
      action: "cache_rule.create",
      resourceType: "cache_rule",
      resourceId: rule.id,
      environmentId: input.environmentId,
      newValue: input,
    });

    return rule;
  }

  /**
   * Updates an existing cache rule.
   */
  static async updateRule(
    db: PrismaClient,
    organizationId: string,
    actorId: string | undefined,
    id: string,
    input: UpdateCacheRuleInput,
  ) {
    const existing = await db.cacheRule.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    const updated = await db.cacheRule.update({
      where: { id },
      data: input,
    });

    await writeAudit(db, {
      organizationId,
      actorId,
      action: "cache_rule.update",
      resourceType: "cache_rule",
      resourceId: id,
      environmentId: existing.environmentId,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  /**
   * Deletes a cache rule.
   */
  static async deleteRule(
    db: PrismaClient,
    organizationId: string,
    actorId: string | undefined,
    id: string,
  ) {
    const existing = await db.cacheRule.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    await db.cacheRule.delete({ where: { id } });

    await writeAudit(db, {
      organizationId,
      actorId,
      action: "cache_rule.delete",
      resourceType: "cache_rule",
      resourceId: id,
      environmentId: existing.environmentId,
      oldValue: existing,
    });

    return { ok: true };
  }

  /**
   * Emits cache invalidation event and broadcasts to queue.
   */
  static async invalidateCache(
    db: PrismaClient,
    organizationId: string,
    input: InvalidateCacheInput,
  ) {
    const event = await db.cacheInvalidationEvent.create({
      data: {
        organizationId,
        kind: input.kind,
        cacheRuleId: input.cacheRuleId,
      },
    });

    queue.publish("CACHE_INVALIDATED", {
      organizationId,
      ...input,
    });

    return event;
  }

  /**
   * Fetches cache performance analytics from ClickHouse or Postgres fallback.
   */
  static async getAnalytics(db: PrismaClient, organizationId: string, environmentId: string) {
    return queryCacheStats(db, {
      organizationId,
      environmentId,
    });
  }

  /**
   * Computes heuristic cache recommendations based on endpoint traffic, latency, and mutations.
   */
  static async getRecommendations(
    db: PrismaClient,
    organizationId: string,
    environmentId?: string,
  ) {
    const records = await db.requestRecord.findMany({
      where: {
        organizationId,
        environmentId: environmentId || undefined,
      },
      take: 500,
    });

    const grouped = new Map<
      string,
      { path: string; method: string; rps: number; p95Ms: number; changeFrequency: number }
    >();

    for (const r of records) {
      const k = `${r.method} ${r.path}`;
      const g = grouped.get(k) ?? {
        path: r.path,
        method: r.method,
        rps: 0,
        p95Ms: r.durationMs,
        changeFrequency: 0.01,
      };
      g.rps += 1;
      g.p95Ms = Math.max(g.p95Ms, r.durationMs);
      grouped.set(k, g);
    }

    return recommendCache([...grouped.values()]);
  }

  /**
   * Creates point-in-time runtime snapshot bundling config, topology, health, and cache rules.
   */
  static async createRuntimeSnapshot(
    db: PrismaClient,
    organizationId: string,
    environmentId: string,
  ) {
    const [config, topology, health, cache] = await Promise.all([
      db.runtimeVersion.findFirst({ where: { environmentId }, orderBy: { seq: "desc" } }),
      db.topologyEdge.findMany({ where: { environmentId } }),
      db.runtimeHealthSnapshot.findFirst({
        where: { environmentId },
        orderBy: { capturedAt: "desc" },
      }),
      db.cacheRule.findMany({ where: { environmentId } }),
    ]);

    return db.runtimeSnapshot.create({
      data: {
        organizationId,
        environmentId,
        payload: { config, topology, health, cache } as object,
      },
    });
  }

  /**
   * Derives real traffic distribution from recent requests and saves as TrafficSnapshot.
   */
  static async createTrafficSnapshot(
    db: PrismaClient,
    organizationId: string,
    environmentId: string,
  ) {
    const records = await db.requestRecord.findMany({
      where: { environmentId, organizationId },
      take: 1000,
    });

    const counts = new Map<string, number>();
    for (const r of records) {
      counts.set(r.path, (counts.get(r.path) ?? 0) + 1);
    }

    const total = records.length || 1;
    const distribution = [...counts.entries()].map(([path, n]) => ({
      path,
      pct: n / total,
      count: n,
    }));

    return db.trafficSnapshot.create({
      data: {
        organizationId,
        environmentId,
        distribution: distribution as object,
      },
    });
  }
}
