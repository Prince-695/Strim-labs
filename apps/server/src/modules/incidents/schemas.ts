import { z } from "@hono/zod-openapi";

export const EvaluateIncidentSchema = z.object({
  environmentId: z.string().openapi({ description: "Target environment ID", example: "env_prod_abc123" }),
  errorRate: z.number().min(0).max(1).openapi({ description: "Observed error rate", example: 0.08 }),
  p95Ms: z.number().min(0).openapi({ description: "Observed P95 latency in milliseconds", example: 1450 }),
}).openapi({
  title: "EvaluateIncidentRequest",
});

export const IncidentFactorSchema = z.object({
  id: z.string().openapi({ example: "fac_123abc" }),
  label: z.string().openapi({ example: "Error rate exceeded baseline" }),
  confidence: z.enum(["High", "Medium", "Low"]).openapi({ example: "High" }),
  sourceId: z.string().openapi({ example: "metrics" }),
  occurredAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
});

export const IncidentTimelineEventSchema = z.object({
  id: z.string().openapi({ example: "evt_123abc" }),
  label: z.string().openapi({ example: "Change plan created" }),
  occurredAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
});

export const IncidentDetailSchema = z.object({
  id: z.string().openapi({ example: "inc_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().openapi({ example: "env_prod_abc123" }),
  title: z.string().openapi({ example: "Error rate anomaly" }),
  severity: z.string().openapi({ example: "high" }),
  status: z.string().openapi({ example: "open" }),
  changePlanId: z.string().nullable().openapi({ example: "cplan_123abc" }),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
  resolvedAt: z.string().datetime().nullable().openapi({ example: null }),
  factors: z.array(IncidentFactorSchema).optional(),
  timeline: z.array(IncidentTimelineEventSchema).optional(),
}).openapi({
  title: "IncidentDetail",
});

export const ListIncidentsResponseSchema = z.object({
  incidents: z.array(IncidentDetailSchema),
}).openapi({
  title: "ListIncidentsResponse",
});

export const EvaluateIncidentResponseSchema = z.object({
  triggered: z.boolean().openapi({ example: true }),
  threshold: z.number().optional().openapi({ example: 0.025 }),
  incident: IncidentDetailSchema.optional(),
}).openapi({
  title: "EvaluateIncidentResponse",
});

export const NotificationDetailSchema = z.object({
  id: z.string().openapi({ example: "notif_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  userId: z.string().nullable().openapi({ example: null }),
  title: z.string().openapi({ example: "Incident opened" }),
  body: z.string().openapi({ example: "Error rate anomaly detected in production" }),
  read: z.boolean().openapi({ example: false }),
  createdAt: z.string().datetime().openapi({ example: "2026-09-29T22:30:00.000Z" }),
}).openapi({
  title: "NotificationDetail",
});

export const ListNotificationsResponseSchema = z.object({
  notifications: z.array(NotificationDetailSchema),
}).openapi({
  title: "ListNotificationsResponse",
});

export const ResolveIncidentResponseSchema = z.object({
  id: z.string().openapi({ example: "inc_123abc" }),
  status: z.string().openapi({ example: "resolved" }),
  resolvedAt: z.string().datetime().openapi({ example: "2026-09-29T22:35:00.000Z" }),
}).openapi({
  title: "ResolveIncidentResponse",
});

export const RollbackIncidentResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: "Instant rollback executed for correlated change plan" }),
  restoredVersionId: z.string().nullable().openapi({ example: "ver_seq_1" }),
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "NOT_FOUND" }),
  message: z.string().optional().openapi({ example: "Incident or environment not found" }),
});
