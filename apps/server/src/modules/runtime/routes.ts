import { createRoute } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  RuntimeEventsResponseSchema,
  RuntimeOverviewQuerySchema,
  RuntimeOverviewResponseSchema,
  RuntimeTimeseriesQuerySchema,
  RuntimeTimeseriesResponseSchema,
} from "./schemas";

const tags = ["Runtime Observability"];

export const getRuntimeOverviewRoute = createRoute({
  method: "get",
  path: "/overview",
  tags,
  summary: "Get runtime health overview",
  description:
    "Returns real-time health score (0-100) with explainability breakdown (availability, latency, errors, dependencies), RPS, percentiles (p50/p95/p99), and active incidents.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: RuntimeOverviewQuerySchema,
  },
  responses: {
    200: {
      description: "Runtime health overview and live performance metrics",
      content: { "application/json": { schema: RuntimeOverviewResponseSchema } },
    },
    400: {
      description: "Validation error (missing environmentId)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Environment not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getRuntimeTimeseriesRoute = createRoute({
  method: "get",
  path: "/timeseries",
  tags,
  summary: "Get runtime timeseries metrics",
  description: "Returns aggregated metric buckets over the requested time window.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: RuntimeTimeseriesQuerySchema,
  },
  responses: {
    200: {
      description: "Timeseries points for latency, RPS, and error rate",
      content: { "application/json": { schema: RuntimeTimeseriesResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getRuntimeEventsRoute = createRoute({
  method: "get",
  path: "/events",
  tags,
  summary: "Get recent live runtime events",
  description: "Returns the latest 50 streaming queue events for the tenant organization.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: {
      description: "Recent runtime events",
      content: { "application/json": { schema: RuntimeEventsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
