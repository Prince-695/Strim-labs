import { z } from "@hono/zod-openapi";

export const ChangePlanStateEnum = z.enum([
  "DRAFT",
  "VALIDATING",
  "SIMULATION_PENDING",
  "SIMULATING",
  "SIMULATION_PASSED",
  "SIMULATION_FAILED",
  "APPROVAL_PENDING",
  "APPROVED",
  "REJECTED",
  "ROLLING_OUT",
  "ROLLOUT_PAUSED",
  "MONITORING",
  "COMPLETED",
  "ROLLBACK_PENDING",
  "ROLLED_BACK",
]).openapi({
  description: "Change plan lifecycle state across the 12-state verification machine",
  example: "APPROVED",
});

export const RiskLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH"]).openapi({
  description: "Evaluated risk tier based on blast radius, traffic, and change diff",
  example: "LOW",
});

export const CreateChangePlanSchema = z.object({
  environmentId: z.string().openapi({
    description: "Target environment identifier",
    example: "env_prod_abc123",
  }),
  title: z.string().min(1).openapi({
    description: "Short descriptive title for the change",
    example: "Enable Redis edge caching and tune checkout timeout",
  }),
  description: z.string().min(1).openapi({
    description: "Detailed description of the change rationale and scope",
    example: "Enables edge cache for products and reduces payment timeout to 3000ms",
  }),
  objective: z.string().min(1).openapi({
    description: "Measurable performance or business objective",
    example: "Reduce origin RPS by 60% and improve P95 latency below 300ms",
  }),
  proposed: z.record(z.unknown()).openapi({
    description: "Key-value map of proposed configuration values for the new runtime version",
    example: { "cache.enabled": true, "timeout.ms": 3000 },
  }),
  gitCommit: z.string().optional().openapi({
    description: "Associated git commit SHA",
    example: "74c9ddd",
  }),
  gitBranch: z.string().optional().openapi({
    description: "Associated git branch name",
    example: "feature/fast-checkout",
  }),
  gitPullRequest: z.string().optional().openapi({
    description: "Associated pull request URL or number",
    example: "https://github.com/acme/repo/pull/142",
  }),
}).openapi({
  title: "CreateChangePlanRequest",
});

export const UpdateChangePlanSchema = z.object({
  title: z.string().optional().openapi({ example: "Updated Change Plan Title" }),
  description: z.string().optional().openapi({ example: "Updated description text" }),
  objective: z.string().optional().openapi({ example: "Updated objective metric" }),
  gitCommit: z.string().optional().openapi({ example: "b3dde34" }),
  gitBranch: z.string().optional().openapi({ example: "main" }),
  gitPullRequest: z.string().optional().openapi({ example: "https://github.com/acme/repo/pull/145" }),
}).openapi({
  title: "UpdateChangePlanRequest",
});

export const ApproveChangePlanSchema = z.object({
  override: z.boolean().optional().openapi({
    description: "Explicit override flag required if approving a plan with SIMULATION_FAILED",
    example: false,
  }),
  justification: z.string().optional().openapi({
    description: "Audited justification text (mandatory if override is true)",
    example: "Approved by VP of Engineering for emergency hotfix mitigation",
  }),
}).openapi({
  title: "ApproveChangePlanRequest",
});

export const GuardrailCheckSchema = z.object({
  errorRate: z.number().min(0).max(1).optional().openapi({
    description: "Observed error rate (0.0 to 1.0); if omitted, queried automatically from ClickHouse telemetry",
    example: 0.015,
  }),
  p95Ms: z.number().min(0).optional().openapi({
    description: "Observed P95 latency in milliseconds; if omitted, queried automatically from ClickHouse telemetry",
    example: 320,
  }),
  availability: z.number().min(0).max(1).optional().openapi({
    description: "Observed availability fraction (0.0 to 1.0)",
    example: 0.998,
  }),
}).openapi({
  title: "GuardrailCheckRequest",
});

export const GuardrailCheckResponseSchema = z.object({
  action: z.enum(["continue", "pause", "stop", "rollback"]).openapi({
    description: "Enforced guardrail decision based on thresholds",
    example: "continue",
  }),
  reason: z.string().optional().openapi({
    example: "All observed health metrics are within safe operational boundaries",
  }),
  metrics: z.object({
    errorRate: z.number().openapi({ example: 0.015 }),
    p95Ms: z.number().openapi({ example: 320 }),
    availability: z.number().openapi({ example: 0.998 }),
  }),
}).openapi({
  title: "GuardrailCheckResponse",
});

export const ChangePlanDetailSchema = z.object({
  id: z.string().openapi({ example: "cplan_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().openapi({ example: "env_prod_abc123" }),
  title: z.string().openapi({ example: "Enable Redis edge caching and tune checkout timeout" }),
  description: z.string().openapi({ example: "Enables edge cache for products and reduces payment timeout to 3000ms" }),
  objective: z.string().openapi({ example: "Reduce origin RPS by 60% and improve P95 latency below 300ms" }),
  state: ChangePlanStateEnum,
  currentVersionId: z.string().nullable().openapi({ example: "ver_seq_1" }),
  proposedVersionId: z.string().nullable().openapi({ example: "ver_seq_2" }),
  simulationId: z.string().nullable().openapi({ example: "sim_456def" }),
  riskLevel: RiskLevelEnum.nullable(),
  riskPayload: z.any().openapi({ description: "Explainable risk score factors and numerical score" }),
  blastRadius: z.any().openapi({ description: "Array of dependent service names calculated from topology graph" }),
  rolloutPercent: z.number().openapi({ example: 25 }),
  gitCommit: z.string().nullable().openapi({ example: "74c9ddd" }),
  gitBranch: z.string().nullable().openapi({ example: "main" }),
  gitPullRequest: z.string().nullable().openapi({ example: "https://github.com/acme/repo/pull/142" }),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
  updatedAt: z.string().datetime().openapi({ example: "2026-09-29T22:35:00.000Z" }),
  approvals: z.array(z.any()).optional(),
  transitions: z.array(z.any()).optional(),
  rollouts: z.array(z.any()).optional(),
  simulation: z.any().optional(),
}).openapi({
  title: "ChangePlanDetail",
});

export const ListChangePlansQuerySchema = z.object({
  environmentId: z.string().optional().openapi({ description: "Filter by environment ID" }),
  limit: z.coerce.number().min(1).max(100).default(50).optional().openapi({ description: "Max records to return" }),
});

export const ListChangePlansResponseSchema = z.object({
  changePlans: z.array(ChangePlanDetailSchema),
}).openapi({
  title: "ListChangePlansResponse",
});

export const DeleteChangePlanResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: "Change plan deleted successfully" }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "NOT_FOUND" }),
  message: z.string().optional().openapi({ example: "Change plan or environment not found" }),
});
