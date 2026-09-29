import { z } from "@hono/zod-openapi";

export const HealthBreakdownSchema = z
  .object({
    availability: z.number().int().min(0).max(100).openapi({ example: 100 }),
    latency: z.number().int().min(0).max(100).openapi({ example: 95 }),
    errors: z.number().int().min(0).max(100).openapi({ example: 100 }),
    trafficAnomaly: z.number().int().min(0).max(100).openapi({ example: 100 }),
    dependencies: z.number().int().min(0).max(100).openapi({ example: 100 }),
    cache: z.number().int().min(0).max(100).openapi({ example: 90 }),
    saturation: z.number().int().min(0).max(100).openapi({ example: 98 }),
  })
  .openapi("HealthBreakdown");

export const HealthScoreSchema = z
  .object({
    score: z.number().int().min(0).max(100).openapi({ example: 98 }),
    breakdown: HealthBreakdownSchema,
  })
  .openapi("HealthScore");

export const RuntimeOverviewQuerySchema = z.object({
  environmentId: z.string().openapi({
    description: "Environment identifier",
    example: "env_prod_123",
  }),
});

export const RuntimeOverviewResponseSchema = z
  .object({
    application: z.string().openapi({ example: "checkout-service" }),
    environment: z.string().openapi({ example: "production" }),
    health: HealthScoreSchema,
    traffic: z.object({
      rps: z.number().openapi({ example: 450 }),
    }),
    latency: z.object({
      p50: z.number().openapi({ example: 25 }),
      p95: z.number().openapi({ example: 60 }),
      p99: z.number().openapi({ example: 110 }),
    }),
    errorRate: z.number().openapi({ example: 0.001 }),
    totalRequests: z.number().int().openapi({ example: 154200 }),
    currentVersion: z.unknown().nullable().optional(),
    activeIncidents: z.array(z.unknown()).optional(),
  })
  .openapi("RuntimeOverviewResponse");

export const RuntimeTimeseriesQuerySchema = z.object({
  environmentId: z.string().openapi({ example: "env_prod_123" }),
  minutes: z.string().optional().openapi({ example: "60" }),
});

export const TimeseriesPointSchema = z
  .object({
    bucket: z.string().openapi({ example: "2026-09-29T12:00:00.000Z" }),
    rps: z.number().openapi({ example: 120 }),
    p95Ms: z.number().openapi({ example: 45 }),
    errorRate: z.number().openapi({ example: 0.002 }),
  })
  .openapi("TimeseriesPoint");

export const RuntimeTimeseriesResponseSchema = z
  .object({
    points: z.array(TimeseriesPointSchema),
  })
  .openapi("RuntimeTimeseriesResponse");

export const RuntimeEventsResponseSchema = z
  .object({
    events: z.array(z.unknown()).openapi({ description: "Recent live events in the organization" }),
  })
  .openapi("RuntimeEventsResponse");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().optional().openapi({ example: "Resource not found" }),
  })
  .openapi("ErrorResponse");
