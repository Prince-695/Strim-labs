import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { CacheService } from "./service";
import type { CreateCacheRuleInput, InvalidateCacheInput, UpdateCacheRuleInput } from "./types";

export async function listRulesHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const rules = await CacheService.listRules(c.get("db"), organizationId, environmentId);

  return c.json({ rules }, 200);
}

export async function createRuleHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as CreateCacheRuleInput;
  const rule = await CacheService.createRule(c.get("db"), organizationId, c.get("userId"), body);

  return c.json(rule, 201);
}

export async function updateRuleHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const body = (await c.req.json()) as UpdateCacheRuleInput;
  const rule = await CacheService.updateRule(c.get("db"), organizationId, c.get("userId"), id, body);

  if (!rule) {
    return c.json({ error: "NOT_FOUND", message: "Cache rule not found" }, 404);
  }

  return c.json(rule, 200);
}

export async function deleteRuleHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const id = c.req.param("id");
  const result = await CacheService.deleteRule(c.get("db"), organizationId, c.get("userId"), id);

  if (!result) {
    return c.json({ error: "NOT_FOUND", message: "Cache rule not found" }, 404);
  }

  return c.json({ ok: true }, 200);
}

export async function invalidateHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as InvalidateCacheInput;
  const event = await CacheService.invalidateCache(c.get("db"), organizationId, body);

  return c.json(event, 200);
}

export async function getAnalyticsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId") ?? "";
  const stats = await CacheService.getAnalytics(c.get("db"), organizationId, environmentId);

  return c.json(stats, 200);
}

export async function getRecommendationsHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const environmentId = c.req.query("environmentId");
  const recommendations = await CacheService.getRecommendations(c.get("db"), organizationId, environmentId);

  return c.json({ recommendations }, 200);
}

export async function createRuntimeSnapshotHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as { environmentId: string };
  const snapshot = await CacheService.createRuntimeSnapshot(c.get("db"), organizationId, body.environmentId);

  return c.json(snapshot, 201);
}

export async function createTrafficSnapshotHandler(c: Context<AppEnv>) {
  const organizationId = c.get("organizationId");
  if (!organizationId) {
    return c.json({ error: "UNAUTHORIZED", message: "Organization context required" }, 401);
  }

  const body = (await c.req.json()) as { environmentId: string };
  const snapshot = await CacheService.createTrafficSnapshot(c.get("db"), organizationId, body.environmentId);

  return c.json(snapshot, 201);
}
