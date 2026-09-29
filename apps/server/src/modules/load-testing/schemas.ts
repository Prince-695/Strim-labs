import { z } from "@hono/zod-openapi";

export const LoadTestProfileEnum = z.enum(["load", "stress", "spike", "endurance", "capacity"]).openapi({
  description: "Load profile strategy: load (steady), stress (step-up ramp), spike (instant burst), endurance (soak), capacity (breaking point search)",
  example: "stress",
});

export const CreateLoadTestSchema = z.object({
  environmentId: z.string().openapi({
    description: "Target environment identifier",
    example: "env_staging_abc123",
  }),
  kind: LoadTestProfileEnum,
  name: z.string().optional().openapi({
    description: "Descriptive label for this load test execution",
    example: "Black Friday Staging Stress Run",
  }),
  targetRps: z.number().min(1).max(100000).openapi({
    description: "Target throughput in requests per second",
    example: 500,
  }),
  durationSeconds: z.number().min(5).max(3600).default(30).openapi({
    description: "Total duration of the load test in seconds (5s to 3600s)",
    example: 30,
  }),
  scale: z.number().min(0.1).max(100).default(1).openapi({
    description: "Traffic multiplier scale factor against base distribution",
    example: 1.5,
  }),
  targetUrl: z.string().url().optional().openapi({
    description: "Optional custom endpoint URL to stress test (SSRF protected)",
    example: "http://localhost:8080/v1/runtime/overview",
  }),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET").openapi({
    description: "HTTP method to execute against target URL",
    example: "GET",
  }),
  concurrency: z.number().min(1).max(1000).default(10).openapi({
    description: "Simulated concurrent virtual users / connection pool size",
    example: 25,
  }),
  headers: z.record(z.string()).optional().openapi({
    description: "Optional HTTP request headers to attach",
    example: { "User-Agent": "Strim-LoadTest-Engine/1.0" },
  }),
  preserveDistribution: z.boolean().default(true).openapi({
    description: "Derive endpoint path percentages from real environment traffic snapshots",
    example: true,
  }),
  auditDefensivePosture: z.boolean().default(true).openapi({
    description: "Perform cyber resilience probes: rate-limit backpressure (429), stack trace leakage, and unhandled errors",
    example: true,
  }),
}).openapi({
  title: "CreateLoadTestRequest",
  description: "Configuration payload to initiate a high-throughput load test run",
});

export const BreakingPointSchema = z.object({
  sustainableRps: z.number().openapi({ description: "Maximum RPS before latency or error degradation occurs", example: 350 }),
  degradationOnsetRps: z.number().openapi({ description: "RPS threshold where error rate reaches >= 2% or p95 >= 800ms", example: 600 }),
  criticalFailureRps: z.number().openapi({ description: "RPS threshold where server collapses (errors >= 5% or p95 >= 2000ms)", example: 950 }),
  recommendation: z.string().openapi({ description: "Actionable engineering capacity recommendation", example: "Keep traffic at or below 350 RPS. Degradation begins near 600 RPS." }),
}).openapi({
  title: "BreakingPointResult",
  description: "Evaluated server saturation and capacity breaking thresholds",
});

export const DefensiveFindingSchema = z.object({
  category: z.enum(["rate_limiting", "error_hygiene", "timeout_resilience", "backpressure"]).openapi({ example: "rate_limiting" }),
  status: z.enum(["PASS", "WARN", "FAIL"]).openapi({ example: "PASS" }),
  observation: z.string().openapi({ example: "Server returned 429 Too Many Requests with Retry-After header during spike" }),
  recommendation: z.string().openapi({ example: "Rate-limiting threshold is appropriately calibrated" }),
});

export const DefensivePostureAuditSchema = z.object({
  overallGrade: z.enum(["A+", "A", "B", "C", "F"]).openapi({ description: "Overall cyber resilience posture rating", example: "A" }),
  score: z.number().min(0).max(100).openapi({ description: "Resilience score out of 100", example: 88 }),
  rateLimitEnforced: z.boolean().openapi({ description: "Whether the server properly enforced 429 backpressure under burst load", example: true }),
  leakedStackTraces: z.boolean().openapi({ description: "Whether internal error responses leaked stack traces or raw debug frames", example: false }),
  unhandledServerErrors: z.number().openapi({ description: "Count of 500/502/503 responses vs handled 429s", example: 2 }),
  findings: z.array(DefensiveFindingSchema),
}).openapi({
  title: "DefensivePostureAudit",
  description: "Auditing of target server resilience against DDoS, connection exhaustion, and information leakage",
});

export const SampleMetricSchema = z.object({
  timestamp: z.string().openapi({ example: "2026-09-29T22:30:00.000Z" }),
  rps: z.number().openapi({ example: 450 }),
  p50Ms: z.number().openapi({ example: 120 }),
  p90Ms: z.number().openapi({ example: 280 }),
  p95Ms: z.number().openapi({ example: 340 }),
  p99Ms: z.number().openapi({ example: 620 }),
  errorRate: z.number().openapi({ example: 0.015 }),
  totalRequests: z.number().openapi({ example: 450 }),
  successfulRequests: z.number().openapi({ example: 443 }),
  failedRequests: z.number().openapi({ example: 7 }),
  rateLimitedRequests: z.number().openapi({ example: 0 }),
});

export const EndpointDistributionSchema = z.object({
  path: z.string().openapi({ example: "/products" }),
  pct: z.number().openapi({ example: 0.6 }),
  rps: z.number().openapi({ example: 300 }),
});

export const LoadTestSummarySchema = z.object({
  totalRequests: z.number().openapi({ example: 15000 }),
  avgRps: z.number().openapi({ example: 500 }),
  peakRps: z.number().openapi({ example: 750 }),
  p95Ms: z.number().openapi({ example: 320 }),
  p99Ms: z.number().openapi({ example: 580 }),
  errorRate: z.number().openapi({ example: 0.012 }),
  statusCodes: z.record(z.number()).openapi({ example: { "200": 14820, "429": 150, "500": 30 } }),
});

export const LoadTestResultSchema = z.object({
  distribution: z.array(EndpointDistributionSchema),
  samples: z.array(SampleMetricSchema),
  summary: LoadTestSummarySchema,
  defensivePosture: DefensivePostureAuditSchema.optional(),
});

export const LoadTestDetailSchema = z.object({
  id: z.string().openapi({ example: "cltest_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().openapi({ example: "env_staging_abc123" }),
  kind: z.string().openapi({ example: "stress" }),
  status: z.string().openapi({ example: "completed" }),
  config: z.any().openapi({ description: "Execution configuration parameters" }),
  result: LoadTestResultSchema.nullable().openapi({ description: "Load test execution results, metrics, and defensive audit" }),
  breakingPoint: BreakingPointSchema.nullable().openapi({ description: "Evaluated breaking point and capacity boundaries" }),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
}).openapi({
  title: "LoadTestDetail",
  description: "Complete load test record including samples, breaking point, and resilience score",
});

export const ListLoadTestsQuerySchema = z.object({
  environmentId: z.string().optional().openapi({ description: "Filter tests by environment ID" }),
  limit: z.coerce.number().min(1).max(100).default(20).optional().openapi({ description: "Max records to return" }),
});

export const ListLoadTestsResponseSchema = z.object({
  loadTests: z.array(LoadTestDetailSchema),
}).openapi({
  title: "ListLoadTestsResponse",
});

export const StopLoadTestResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: "Load test aborted successfully" }),
  status: z.string().openapi({ example: "stopped" }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "NOT_FOUND" }),
  message: z.string().optional().openapi({ example: "Environment or load test not found" }),
});
