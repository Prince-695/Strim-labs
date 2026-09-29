import { createRoute } from "@hono/zod-openapi";
import {
  CacheAnalyticsResponseSchema,
  CacheRecommendationsResponseSchema,
  CacheRuleIdParamSchema,
  CacheRuleSchema,
  CreateCacheRuleSchema,
  ErrorResponseSchema,
  InvalidateCacheResponseSchema,
  InvalidateCacheSchema,
  ListCacheRulesResponseSchema,
  RuntimeSnapshotResponseSchema,
  SnapshotInputSchema,
  TrafficSnapshotResponseSchema,
  UpdateCacheRuleSchema,
} from "./schemas";
import { OptionalEnvironmentQuerySchema } from "../config/schemas";

const tags = ["Cache Management & Snapshots"];

export const listCacheRulesRoute = createRoute({
  method: "get",
  path: "/rules",
  tags,
  summary: "List cache rules",
  description: "Returns all active cache rules configured for the environment.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: OptionalEnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "List of cache rules",
      content: { "application/json": { schema: ListCacheRulesResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const createCacheRuleRoute = createRoute({
  method: "post",
  path: "/rules",
  tags,
  summary: "Create cache rule",
  description: "Creates a new caching policy for an endpoint pattern with defined TTL and tags.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateCacheRuleSchema } },
    },
  },
  responses: {
    201: {
      description: "Cache rule created",
      content: { "application/json": { schema: CacheRuleSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const updateCacheRuleRoute = createRoute({
  method: "patch",
  path: "/rules/:id",
  tags,
  summary: "Update cache rule",
  description: "Updates TTL, status, or tags for an existing cache rule.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: CacheRuleIdParamSchema,
    body: {
      content: { "application/json": { schema: UpdateCacheRuleSchema } },
    },
  },
  responses: {
    200: {
      description: "Updated cache rule",
      content: { "application/json": { schema: CacheRuleSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Rule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const deleteCacheRuleRoute = createRoute({
  method: "delete",
  path: "/rules/:id",
  tags,
  summary: "Delete cache rule",
  description: "Removes an active cache rule.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: CacheRuleIdParamSchema,
  },
  responses: {
    200: {
      description: "Cache rule removed",
      content: { "application/json": { schema: CacheRuleSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Rule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const invalidateCacheRoute = createRoute({
  method: "post",
  path: "/invalidate",
  tags,
  summary: "Invalidate cache entries",
  description: "Triggers targeted cache purge by tag, endpoint, or manual wildcard, broadcasting invalidation event.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: InvalidateCacheSchema } },
    },
  },
  responses: {
    200: {
      description: "Invalidation event recorded and emitted",
      content: { "application/json": { schema: InvalidateCacheResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getCacheAnalyticsRoute = createRoute({
  method: "get",
  path: "/analytics",
  tags,
  summary: "Get cache performance analytics",
  description: "Returns cache hit rates, hits vs misses, estimated origin RPS reduction, and bandwidth savings.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: OptionalEnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "Cache metrics and analytics",
      content: { "application/json": { schema: CacheAnalyticsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getCacheRecommendationsRoute = createRoute({
  method: "get",
  path: "/recommendations",
  tags,
  summary: "Get heuristic cache recommendations",
  description: "Identifies endpoints with high read volumes and low mutation frequencies that would benefit from caching.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: OptionalEnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "List of recommended cache candidates",
      content: { "application/json": { schema: CacheRecommendationsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const createRuntimeSnapshotRoute = createRoute({
  method: "post",
  path: "/snapshots/runtime",
  tags,
  summary: "Capture point-in-time runtime snapshot",
  description: "Bundles current configuration, topology, health state, and cache rules into an immutable snapshot.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: SnapshotInputSchema } },
    },
  },
  responses: {
    201: {
      description: "Runtime snapshot captured",
      content: { "application/json": { schema: RuntimeSnapshotResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const createTrafficSnapshotRoute = createRoute({
  method: "post",
  path: "/snapshots/traffic",
  tags,
  summary: "Capture traffic distribution snapshot",
  description: "Derives and records real traffic distribution percentages from recent request history.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: SnapshotInputSchema } },
    },
  },
  responses: {
    201: {
      description: "Traffic snapshot captured",
      content: { "application/json": { schema: TrafficSnapshotResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
