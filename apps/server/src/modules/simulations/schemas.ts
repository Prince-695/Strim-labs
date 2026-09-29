import { z } from "@hono/zod-openapi";

export const WhatIfChangeSchema = z.object({
  kind: z.enum(["traffic", "cache", "timeout", "dependencyLatency", "dependencyUnavailable"]).openapi({
    description: "What-If simulation model scenario",
    example: "traffic",
  }),
  multiplier: z.number().min(0.01).max(100).optional().openapi({
    description: "Traffic scale factor (e.g., 2.0 = 2x baseline traffic)",
    example: 2.5,
  }),
  enabled: z.boolean().optional().openapi({
    description: "Simulate enabling or disabling edge cache",
    example: true,
  }),
  fromMs: z.number().optional().openapi({
    description: "Current upstream/downstream timeout in milliseconds",
    example: 5000,
  }),
  toMs: z.number().optional().openapi({
    description: "Proposed upstream/downstream timeout in milliseconds",
    example: 3000,
  }),
  factor: z.number().min(0.01).max(100).optional().openapi({
    description: "Dependency latency degradation multiplier",
    example: 2.0,
  }),
  dependency: z.string().optional().openapi({
    description: "Downstream dependency service or endpoint name",
    example: "payment-gateway",
  }),
}).openapi({
  title: "WhatIfChange",
  description: "Hypothetical scenario parameters to model against baseline telemetry",
});

export const ComparisonMetricsSchema = z.object({
  p95Ms: z.number().openapi({ example: 420 }),
  p99Ms: z.number().openapi({ example: 800 }),
  errorRate: z.number().openapi({ example: 0.02 }),
  originRps: z.number().openapi({ example: 120 }),
  cacheHitRate: z.number().openapi({ example: 0.0 }),
}).openapi({
  title: "ComparisonMetrics",
  description: "Performance metrics snapshot (latency, errors, origin throughput, cache hit rate)",
});

export const ComparisonDeltaSchema = z.object({
  metric: z.string().openapi({ example: "p95Ms" }),
  baseline: z.number().openapi({ example: 420 }),
  experiment: z.number().openapi({ example: 252 }),
  deltaPct: z.number().openapi({ example: -40.0 }),
}).openapi({
  title: "ComparisonDelta",
  description: "Metric delta and percentage shift between baseline and experiment run",
});

export const PassFailEvaluationSchema = z.object({
  passed: z.boolean().openapi({ description: "Whether the proposed change passes performance gating", example: true }),
  regressed: z.boolean().openapi({ description: "Whether a critical performance or error regression was observed", example: false }),
  reasons: z.array(z.string()).openapi({ example: ["Latency improved by 40%", "Origin RPS dropped by 70%"] }),
  recommendation: z.string().openapi({ example: "Safe to approve for staged canary rollout" }),
}).openapi({
  title: "PassFailEvaluation",
  description: "Automated change gating evaluation based on simulation comparison",
});

export const CreateSimulationSchema = z.object({
  environmentId: z.string().openapi({
    description: "Target environment identifier",
    example: "env_staging_abc123",
  }),
  name: z.string().optional().openapi({
    description: "Optional human-readable title for the simulation",
    example: "Simulate Cache On + 2.5x Black Friday Traffic",
  }),
  scenarioId: z.string().optional().openapi({
    description: "Optional scenario identifier",
    example: "scenario_peak_sale",
  }),
  change: WhatIfChangeSchema,
  customBaseline: ComparisonMetricsSchema.optional().openapi({
    description: "Optional custom baseline metrics; if omitted, derived automatically from recent environment telemetry",
  }),
  maxErrorRateDeltaPct: z.number().default(20).optional().openapi({
    description: "Maximum allowable error rate increase percentage before failing gate",
    example: 15,
  }),
  maxP95DeltaPct: z.number().default(25).optional().openapi({
    description: "Maximum allowable P95 latency increase percentage before failing gate",
    example: 20,
  }),
}).openapi({
  title: "CreateSimulationRequest",
  description: "What-If simulation request parameters",
});

export const SimulationDetailSchema = z.object({
  id: z.string().openapi({ example: "sim_abc123xyz" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().openapi({ example: "env_staging_abc123" }),
  scenarioId: z.string().nullable().openapi({ example: null }),
  status: z.string().openapi({ example: "completed" }),
  baseline: ComparisonMetricsSchema.nullable(),
  experiment: ComparisonMetricsSchema.nullable(),
  comparison: z.array(ComparisonDeltaSchema).nullable(),
  evaluation: PassFailEvaluationSchema.optional(),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
}).openapi({
  title: "SimulationDetail",
  description: "Complete simulation result record with baseline, experiment, comparison, and gate evaluation",
});

export const ListSimulationsQuerySchema = z.object({
  environmentId: z.string().optional().openapi({ description: "Filter simulations by environment ID" }),
  limit: z.coerce.number().min(1).max(100).default(50).optional().openapi({ description: "Max records to return" }),
});

export const ListSimulationsResponseSchema = z.object({
  simulations: z.array(SimulationDetailSchema),
}).openapi({
  title: "ListSimulationsResponse",
});

export const DeleteSimulationResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: "Simulation deleted successfully" }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "NOT_FOUND" }),
  message: z.string().optional().openapi({ example: "Environment or simulation not found" }),
});
