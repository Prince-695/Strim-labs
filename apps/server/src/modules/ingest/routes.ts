import { createRoute } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  IngestAcceptedResponseSchema,
  OtlpTracesPayloadSchema,
  TelemetryEnvelopeSchema,
} from "./schemas";

const tags = ["Telemetry Ingestion"];

export const ingestTelemetryRoute = createRoute({
  method: "post",
  path: "/v1/ingest",
  tags,
  summary: "Ingest telemetry batch (Strim envelope)",
  description:
    "Accepts a batch of telemetry requests, spans, and metrics. Protected by 500KB cap and Redis sliding-window rate limiting.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: TelemetryEnvelopeSchema } },
    },
  },
  responses: {
    202: {
      description: "Batch accepted and enqueued for async processing",
      content: { "application/json": { schema: IngestAcceptedResponseSchema } },
    },
    401: {
      description: "Missing or invalid API key",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    413: {
      description: "Payload exceeds 500KB limit",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: {
      description: "Rate limit exceeded (backpressure shedding)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const otlpTracesRoute = createRoute({
  method: "post",
  path: "/v1/otlp/v1/traces",
  tags,
  summary: "Ingest OpenTelemetry traces",
  description: "Accepts OpenTelemetry-formatted traces and spans, translating them to Strim telemetry envelopes.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: OtlpTracesPayloadSchema } },
    },
  },
  responses: {
    202: {
      description: "OTLP traces accepted and enqueued",
      content: { "application/json": { schema: IngestAcceptedResponseSchema } },
    },
    401: {
      description: "Missing or invalid API key",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    413: {
      description: "Payload exceeds 500KB limit",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    429: {
      description: "Rate limit exceeded",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
