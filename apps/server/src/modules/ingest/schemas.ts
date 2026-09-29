import { z } from "@hono/zod-openapi";

export const TelemetryEventSchema = z
  .object({
    type: z.enum(["span", "request", "metric", "log"]).openapi({
      example: "request",
      description: "Type of telemetry event",
    }),
    requestId: z.string().optional().openapi({ example: "req_987654" }),
    traceId: z.string().optional().openapi({ example: "trace_abcdef" }),
    parentSpanId: z.string().optional(),
    spanId: z.string().optional(),
    method: z.string().optional().openapi({ example: "POST" }),
    path: z.string().optional().openapi({ example: "/api/checkout" }),
    status: z.number().int().optional().openapi({ example: 200 }),
    durationMs: z.number().optional().openapi({ example: 42.5 }),
    service: z.string().optional().openapi({ example: "payment-service" }),
    region: z.string().optional().openapi({ example: "us-east-1" }),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
    attributes: z.record(z.unknown()).optional(),
  })
  .openapi("TelemetryEvent");

export const TelemetryEnvelopeSchema = z
  .object({
    schema: z.literal("strim.telemetry.v1").openapi({ example: "strim.telemetry.v1" }),
    timestamp: z.string().openapi({ example: "2026-09-29T12:00:00.000Z" }),
    organizationHint: z.string().optional(),
    projectId: z.string().openapi({ example: "proj_prod_123" }),
    environment: z.string().openapi({ example: "production" }),
    events: z.array(TelemetryEventSchema).openapi({ description: "Batch of telemetry events" }),
  })
  .openapi("TelemetryEnvelope");

export const OtlpSpanSchema = z
  .object({
    traceId: z.string(),
    spanId: z.string(),
    parentSpanId: z.string().optional(),
    name: z.string(),
    startTimeUnixNano: z.string().optional(),
    endTimeUnixNano: z.string().optional(),
    attributes: z
      .array(
        z.object({
          key: z.string(),
          value: z.object({
            stringValue: z.string().optional(),
            intValue: z.string().optional(),
          }),
        }),
      )
      .optional(),
  })
  .openapi("OtlpSpan");

export const OtlpTracesPayloadSchema = z
  .object({
    projectId: z.string().optional(),
    environment: z.string().optional(),
    resourceSpans: z.array(
      z.object({
        scopeSpans: z.array(
          z.object({
            spans: z.array(OtlpSpanSchema),
          }),
        ),
      }),
    ),
  })
  .openapi("OtlpTracesPayload");

export const IngestAcceptedResponseSchema = z
  .object({
    accepted: z.boolean().openapi({ example: true }),
    queuedEvents: z.number().int().optional().openapi({ example: 10 }),
  })
  .openapi("IngestAcceptedResponse");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "RATE_LIMITED" }),
    message: z.string().optional().openapi({ example: "Telemetry ingestion rate limit exceeded" }),
  })
  .openapi("ErrorResponse");
