import { z } from "@hono/zod-openapi";

export const RequestRecordSchema = z
  .object({
    id: z.string().openapi({ example: "rec_12345" }),
    organizationId: z.string().openapi({ example: "org_abc" }),
    environmentId: z.string().openapi({ example: "env_xyz" }),
    requestId: z.string().openapi({ example: "req_998877" }),
    traceId: z.string().openapi({ example: "trace_554433" }),
    method: z.string().openapi({ example: "POST" }),
    path: z.string().openapi({ example: "/v1/orders" }),
    status: z.number().int().openapi({ example: 201 }),
    durationMs: z.number().openapi({ example: 45.2 }),
    region: z.string().nullable().optional().openapi({ example: "us-east-1" }),
    service: z.string().openapi({ example: "order-service" }),
    headers: z.record(z.unknown()).nullable().optional(),
    payloadRef: z.string().nullable().optional(),
    createdAt: z.string().or(z.date()).openapi({ example: "2026-09-29T12:00:00.000Z" }),
  })
  .openapi("RequestRecord");

export const ListRequestsQuerySchema = z.object({
  environmentId: z.string().optional().openapi({ description: "Filter by environment ID" }),
  service: z.string().optional().openapi({ description: "Filter by service name" }),
  method: z.string().optional().openapi({ description: "Filter by HTTP method (GET, POST, etc.)" }),
  status: z.string().optional().openapi({ description: "Filter by HTTP status code" }),
  limit: z.string().optional().openapi({ description: "Page limit, defaults to 50" }),
  offset: z.string().optional().openapi({ description: "Offset for pagination" }),
});

export const ListRequestsResponseSchema = z
  .object({
    requests: z.array(RequestRecordSchema),
    total: z.number().int().optional().openapi({ example: 42 }),
  })
  .openapi("ListRequestsResponse");

export const RequestIdParamSchema = z.object({
  id: z.string().openapi({
    param: { name: "id", in: "path" },
    description: "Request record identifier",
    example: "rec_12345",
  }),
});

export const TraceSpanSchema = z
  .object({
    id: z.string().openapi({ example: "rec_span_01" }),
    service: z.string().openapi({ example: "payment-gateway" }),
    path: z.string().openapi({ example: "/charges" }),
    method: z.string().openapi({ example: "POST" }),
    status: z.number().int().openapi({ example: 200 }),
    durationMs: z.number().openapi({ example: 24.5 }),
    offsetMs: z.number().openapi({ example: 12.3 }),
    createdAt: z.string().or(z.date()),
  })
  .openapi("TraceSpan");

export const TraceWaterfallResponseSchema = z
  .object({
    root: RequestRecordSchema,
    totalDurationMs: z.number().openapi({ example: 45.2 }),
    spans: z.array(TraceSpanSchema),
  })
  .openapi("TraceWaterfallResponse");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().optional().openapi({ example: "Request record not found" }),
  })
  .openapi("ErrorResponse");
