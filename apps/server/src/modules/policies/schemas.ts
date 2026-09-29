import { z } from "@hono/zod-openapi";

export const PolicyScopeEnum = z.enum([
  "organization",
  "workspace",
  "application",
  "environment",
  "api_key",
  "user",
  "ip",
  "endpoint",
]).openapi({
  description: "Hierarchical scope where rate limit or governance rule applies",
  example: "application",
});

export const DriftActionEnum = z.enum(["inspect", "accept", "correct", "create_change_plan"]).openapi({
  description: "Remediation action for detected configuration drift",
  example: "accept",
});

export const CreatePolicySchema = z.object({
  kind: z.string().min(1).openapi({ example: "guardrail" }),
  name: z.string().min(1).openapi({ example: "Enforce Error Rate < 5% during Rollout" }),
  body: z.record(z.unknown()).openapi({ example: { maxErrorRate: 0.05, maxP95Ms: 2000 } }),
  environmentId: z.string().optional().openapi({ example: "env_prod_abc123" }),
}).openapi({
  title: "CreatePolicyRequest",
});

export const UpdatePolicySchema = z.object({
  name: z.string().optional().openapi({ example: "Updated Policy Name" }),
  body: z.record(z.unknown()).optional().openapi({ example: { maxErrorRate: 0.03 } }),
  environmentId: z.string().optional().openapi({ example: "env_prod_abc123" }),
}).openapi({
  title: "UpdatePolicyRequest",
});

export const PolicyDetailSchema = z.object({
  id: z.string().openapi({ example: "pol_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().nullable().openapi({ example: null }),
  kind: z.string().openapi({ example: "guardrail" }),
  name: z.string().openapi({ example: "Enforce Error Rate < 5%" }),
  body: z.any(),
  versions: z.array(z.any()).optional(),
}).openapi({
  title: "PolicyDetail",
});

export const ListPoliciesResponseSchema = z.object({
  policies: z.array(PolicyDetailSchema),
}).openapi({
  title: "ListPoliciesResponse",
});

export const CreateRateLimitSchema = z.object({
  scope: PolicyScopeEnum,
  scopeId: z.string().optional().openapi({ example: "app_checkout" }),
  limit: z.number().min(1).openapi({ example: 1000 }),
  windowSeconds: z.number().default(60).openapi({ example: 60 }),
}).openapi({
  title: "CreateRateLimitRequest",
});

export const UpdateRateLimitSchema = z.object({
  scope: PolicyScopeEnum.optional(),
  scopeId: z.string().optional().openapi({ example: "app_checkout" }),
  limit: z.number().min(1).optional().openapi({ example: 1500 }),
  windowSeconds: z.number().optional().openapi({ example: 60 }),
}).openapi({
  title: "UpdateRateLimitRequest",
});

export const RateLimitDetailSchema = z.object({
  id: z.string().openapi({ example: "rl_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  scope: z.string().openapi({ example: "application" }),
  scopeId: z.string().nullable().openapi({ example: "app_checkout" }),
  limit: z.number().openapi({ example: 1000 }),
  windowSeconds: z.number().openapi({ example: 60 }),
}).openapi({
  title: "RateLimitDetail",
});

export const ListRateLimitsResponseSchema = z.object({
  rateLimits: z.array(RateLimitDetailSchema),
}).openapi({
  title: "ListRateLimitsResponse",
});

export const RateLimitEvaluateResponseSchema = z.object({
  applied: RateLimitDetailSchema.nullable(),
}).openapi({
  title: "RateLimitEvaluateResponse",
});

export const CreatePromotionSchema = z.object({
  fromEnvId: z.string().openapi({ description: "Source environment ID (e.g. Staging)", example: "env_staging_123" }),
  toEnvId: z.string().openapi({ description: "Target environment ID (e.g. Production)", example: "env_prod_456" }),
  requireSimulation: z.boolean().default(false).openapi({ description: "Enforce that source env has a passing simulation before promotion", example: true }),
}).openapi({
  title: "CreatePromotionRequest",
});

export const PromotionDetailSchema = z.object({
  id: z.string().openapi({ example: "promo_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  fromEnvId: z.string().openapi({ example: "env_staging_123" }),
  toEnvId: z.string().openapi({ example: "env_prod_456" }),
  requireSimulation: z.boolean().openapi({ example: true }),
  status: z.string().openapi({ example: "completed" }),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
}).openapi({
  title: "PromotionDetail",
});

export const CheckDriftSchema = z.object({
  environmentId: z.string().openapi({ example: "env_prod_123" }),
  actual: z.record(z.unknown()).openapi({ example: { "cache.enabled": true, "timeout.ms": 2500 } }),
}).openapi({
  title: "CheckDriftRequest",
});

export const DriftReportDetailSchema = z.object({
  id: z.string().openapi({ example: "dr_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().openapi({ example: "env_prod_123" }),
  status: z.string().openapi({ example: "open" }),
  expected: z.any(),
  actual: z.any(),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
}).openapi({
  title: "DriftReportDetail",
});

export const DriftCheckResponseSchema = z.object({
  report: DriftReportDetailSchema,
  diffs: z.array(z.any()),
  actions: z.array(z.string()),
}).openapi({
  title: "DriftCheckResponse",
});

export const ListDriftReportsResponseSchema = z.object({
  reports: z.array(DriftReportDetailSchema),
}).openapi({
  title: "ListDriftReportsResponse",
});

export const DriftActionResponseSchema = z.object({
  report: DriftReportDetailSchema,
  action: z.string(),
}).openapi({
  title: "DriftActionResponse",
});

export const DeletePolicyResponseSchema = z.object({
  ok: z.boolean().openapi({ example: true }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "NOT_FOUND" }),
  message: z.string().optional().openapi({ example: "Policy or rate limit not found" }),
});
