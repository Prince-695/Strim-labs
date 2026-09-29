import { z } from "@hono/zod-openapi";

export const CacheRuleSchema = z
  .object({
    id: z.string().openapi({ example: "crule_01" }),
    organizationId: z.string().openapi({ example: "org_abc" }),
    environmentId: z.string().openapi({ example: "env_prod_123" }),
    endpoint: z.string().openapi({ example: "/v1/products" }),
    method: z.string().openapi({ example: "GET" }),
    ttlSeconds: z.number().int().openapi({ example: 300 }),
    enabled: z.boolean().openapi({ example: true }),
    tags: z.array(z.string()).optional().openapi({ example: ["catalog", "products"] }),
  })
  .openapi("CacheRule");

export const ListCacheRulesResponseSchema = z
  .object({
    rules: z.array(CacheRuleSchema),
  })
  .openapi("ListCacheRulesResponse");

export const CacheRuleIdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    description: "Cache rule identifier",
    example: "crule_01",
  }),
});

export const CreateCacheRuleSchema = z
  .object({
    environmentId: z.string().openapi({ example: "env_prod_123" }),
    endpoint: z.string().openapi({ example: "/v1/products" }),
    method: z.string().default("GET").openapi({ example: "GET" }),
    ttlSeconds: z.number().int().min(1).openapi({ example: 300 }),
    tags: z.array(z.string()).optional().openapi({ example: ["catalog"] }),
  })
  .openapi("CreateCacheRuleInput");

export const UpdateCacheRuleSchema = z
  .object({
    endpoint: z.string().optional().openapi({ example: "/v1/products" }),
    method: z.string().optional().openapi({ example: "GET" }),
    ttlSeconds: z.number().int().optional().openapi({ example: 600 }),
    enabled: z.boolean().optional().openapi({ example: true }),
    tags: z.array(z.string()).optional(),
  })
  .openapi("UpdateCacheRuleInput");

export const InvalidateCacheSchema = z
  .object({
    kind: z.enum(["manual", "tag", "endpoint"]).openapi({ example: "tag" }),
    cacheRuleId: z.string().optional().openapi({ example: "crule_01" }),
    tags: z.array(z.string()).optional().openapi({ example: ["catalog"] }),
  })
  .openapi("InvalidateCacheInput");

export const InvalidateCacheResponseSchema = z
  .object({
    id: z.string().openapi({ example: "inv_event_123" }),
    kind: z.string().openapi({ example: "tag" }),
    organizationId: z.string(),
    createdAt: z.string().or(z.date()),
  })
  .openapi("InvalidateCacheResponse");

export const CacheAnalyticsResponseSchema = z
  .object({
    hitRate: z.number().openapi({ example: 0.84 }),
    hits: z.number().int().openapi({ example: 42000 }),
    misses: z.number().int().openapi({ example: 8000 }),
    bandwidthSavedBytes: z.number().openapi({ example: 52428800 }),
    originRpsReduction: z.number().openapi({ example: 350 }),
  })
  .openapi("CacheAnalyticsResponse");

export const CacheRecommendationSchema = z
  .object({
    path: z.string().openapi({ example: "/v1/products" }),
    method: z.string().openapi({ example: "GET" }),
    estimatedHitRate: z.number().openapi({ example: 0.88 }),
    projectedRpsReduction: z.number().openapi({ example: 120 }),
    suggestedTtlSeconds: z.number().int().openapi({ example: 300 }),
    confidence: z.string().openapi({ example: "HIGH" }),
    reason: z.string().openapi({ example: "High read volume with low mutation frequency" }),
  })
  .openapi("CacheRecommendation");

export const CacheRecommendationsResponseSchema = z
  .object({
    recommendations: z.array(CacheRecommendationSchema),
  })
  .openapi("CacheRecommendationsResponse");

export const SnapshotInputSchema = z
  .object({
    environmentId: z.string().openapi({ example: "env_prod_123" }),
  })
  .openapi("SnapshotInput");

export const RuntimeSnapshotResponseSchema = z
  .object({
    id: z.string().openapi({ example: "snap_rt_01" }),
    organizationId: z.string(),
    environmentId: z.string(),
    payload: z.unknown(),
    createdAt: z.string().or(z.date()),
  })
  .openapi("RuntimeSnapshotResponse");

export const TrafficSnapshotResponseSchema = z
  .object({
    id: z.string().openapi({ example: "snap_trf_01" }),
    organizationId: z.string(),
    environmentId: z.string(),
    distribution: z.unknown(),
    createdAt: z.string().or(z.date()),
  })
  .openapi("TrafficSnapshotResponse");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().optional().openapi({ example: "Resource not found" }),
  })
  .openapi("ErrorResponse");
