import { createRoute } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  ListRequestsQuerySchema,
  ListRequestsResponseSchema,
  RequestIdParamSchema,
  RequestRecordSchema,
  TraceWaterfallResponseSchema,
} from "./schemas";

const tags = ["Request Explorer & Traces"];

export const listRequestsRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List and search request records",
  description:
    "Returns paginated request telemetry records with filtering by environment, service, status, and method.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: ListRequestsQuerySchema,
  },
  responses: {
    200: {
      description: "List of request records",
      content: { "application/json": { schema: ListRequestsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getRequestRoute = createRoute({
  method: "get",
  path: "/:id",
  tags,
  summary: "Get request record by ID",
  description: "Returns the full details and metadata for a specific request record.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: RequestIdParamSchema,
  },
  responses: {
    200: {
      description: "Request record details",
      content: { "application/json": { schema: RequestRecordSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Request not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getTraceWaterfallRoute = createRoute({
  method: "get",
  path: "/:id/trace",
  tags,
  summary: "Get trace waterfall timeline",
  description: "Returns the complete distributed trace waterfall with timeline offsets for all correlated spans.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: RequestIdParamSchema,
  },
  responses: {
    200: {
      description: "Distributed trace waterfall with correlated spans",
      content: { "application/json": { schema: TraceWaterfallResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Trace not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
