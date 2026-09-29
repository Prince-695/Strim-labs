import { z } from "@hono/zod-openapi";

export const CiGateSchema = z.object({
  changePlanId: z.string().openapi({ description: "Change plan ID being evaluated", example: "cplan_123abc" }),
  p95RegressionPct: z.number().openapi({ description: "Observed or simulated P95 latency regression percentage", example: 14.5 }),
  thresholdPct: z.number().default(20).optional().openapi({ description: "Maximum acceptable latency regression threshold percentage", example: 20 }),
}).openapi({
  title: "CiGateRequest",
});

export const CiGateResponseSchema = z.object({
  result: z.enum(["PASS", "FAIL"]).openapi({ example: "PASS" }),
  reason: z.string().openapi({ example: "Within threshold" }),
  changePlanId: z.string().openapi({ example: "cplan_123abc" }),
}).openapi({
  title: "CiGateResponse",
});

export const CreateDeploymentSchema = z.object({
  environmentId: z.string().openapi({ example: "env_prod_abc123" }),
  source: z.string().openapi({ example: "github-actions" }),
  sha: z.string().optional().openapi({ example: "b3dde34" }),
  metadata: z.record(z.unknown()).optional(),
}).openapi({
  title: "CreateDeploymentRequest",
});

export const DeploymentEventSchema = z.object({
  id: z.string().openapi({ example: "dep_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().openapi({ example: "env_prod_abc123" }),
  source: z.string().openapi({ example: "github-actions" }),
  sha: z.string().nullable().openapi({ example: "b3dde34" }),
  metadata: z.any(),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
}).openapi({
  title: "DeploymentEvent",
});

export const CreateDeploymentResponseSchema = z.object({
  event: DeploymentEventSchema,
  attributedRuntimeVersion: z.string().nullable().openapi({ example: "ver_seq_2" }),
}).openapi({
  title: "CreateDeploymentResponse",
});

export const ListDeploymentsResponseSchema = z.object({
  deployments: z.array(DeploymentEventSchema),
}).openapi({
  title: "ListDeploymentsResponse",
});

export const PagingIntegrationSchema = z.object({
  id: z.string().openapi({ example: "page_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  provider: z.string().openapi({ example: "pagerduty" }),
  config: z.any(),
}).openapi({
  title: "PagingIntegration",
});

export const CreatePagingSchema = z.object({
  provider: z.string().openapi({ example: "pagerduty" }),
  config: z.record(z.unknown()).openapi({ example: { routingKey: "pd_key_123" } }),
}).openapi({
  title: "CreatePagingRequest",
});

export const ListPagingResponseSchema = z.object({
  integrations: z.array(PagingIntegrationSchema),
}).openapi({
  title: "ListPagingResponse",
});

export const LineageResponseSchema = z.object({
  chain: z.array(z.any()).openapi({ description: "Sequential provenance chain from code commit to incident" }),
}).openapi({
  title: "LineageResponse",
});

export const GithubWebhookResponseSchema = z.object({
  ok: z.boolean().openapi({ example: true }),
  sha: z.string().optional().openapi({ example: "74c9ddd" }),
  linked: z.boolean().openapi({ example: true }),
  ignored: z.boolean().optional(),
  reason: z.string().optional(),
}).openapi({
  title: "GithubWebhookResponse",
});

export const DeleteIntegrationResponseSchema = z.object({
  ok: z.boolean().openapi({ example: true }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "NOT_FOUND" }),
  message: z.string().optional().openapi({ example: "Change plan or integration not found" }),
});
