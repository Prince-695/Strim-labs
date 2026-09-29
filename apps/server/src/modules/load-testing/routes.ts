import { createRoute, z } from "@hono/zod-openapi";
import {
  CreateLoadTestSchema,
  ErrorResponseSchema,
  ListLoadTestsQuerySchema,
  ListLoadTestsResponseSchema,
  LoadTestDetailSchema,
  StopLoadTestResponseSchema,
} from "./schemas";

const tags = ["Load Testing & Resilience Auditing"];

const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Load test execution ID", example: "cltest_123abc" }),
});

export const createLoadTestRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Execute high-throughput load test & breaking point analysis",
  description:
    "Runs configurable high-throughput traffic load (load, stress, spike, endurance, capacity), preserves production-derived distribution, computes breaking point capacity thresholds, and audits cyber resilience against DDoS/unhandled crashes.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateLoadTestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Load test executed with full breaking point analysis and resilience audit",
      content: { "application/json": { schema: LoadTestDetailSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Forbidden (SSRF block or targeting live production)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Target environment not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const listLoadTestsRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List load tests and breaking point records",
  description: "Returns past load test executions, capacity boundaries, and resilience grades.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: ListLoadTestsQuerySchema,
  },
  responses: {
    200: {
      description: "List of load tests",
      content: { "application/json": { schema: ListLoadTestsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getLoadTestRoute = createRoute({
  method: "get",
  path: "/:id",
  tags,
  summary: "Get load test details & resilience audit report",
  description: "Retrieves complete test timeline samples, breaking point thresholds, and defensive posture audit.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: "Detailed load test report",
      content: { "application/json": { schema: LoadTestDetailSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Load test not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const stopLoadTestRoute = createRoute({
  method: "post",
  path: "/:id/stop",
  tags,
  summary: "Stop or abort an in-flight load test",
  description: "Immediately halts active virtual users and transitions load test state to stopped.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: "Load test stopped response",
      content: { "application/json": { schema: StopLoadTestResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Load test not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
