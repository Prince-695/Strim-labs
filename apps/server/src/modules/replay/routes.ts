import { createRoute } from "@hono/zod-openapi";
import {
  CreateReplaySchema,
  ErrorResponseSchema,
  ListReplaysResponseSchema,
  OptionalEnvironmentQuerySchema,
  ReplayIdParamSchema,
  ReplayRecordSchema,
} from "./schemas";

const tags = ["Safe Replay & SSRF Protection"];

export const listReplaysRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List replay executions",
  description: "Returns past request replay executions for the environment.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: OptionalEnvironmentQuerySchema,
  },
  responses: {
    200: {
      description: "List of replay runs",
      content: { "application/json": { schema: ListReplaysResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getReplayRoute = createRoute({
  method: "get",
  path: "/:id",
  tags,
  summary: "Get replay execution details",
  description: "Returns replay run status, sanitized response, and side-by-side comparison delta.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: ReplayIdParamSchema,
  },
  responses: {
    200: {
      description: "Replay details and comparison",
      content: { "application/json": { schema: ReplayRecordSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Replay not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const createReplayRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Execute safe request replay",
  description:
    "Triggers an asynchronous sanitized replay. Enforces RBAC permissions, dangerous operation blocking, and SSRF defense.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateReplaySchema } },
    },
  },
  responses: {
    202: {
      description: "Replay accepted and running asynchronously",
      content: { "application/json": { schema: ReplayRecordSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Forbidden (insufficient role or dangerous endpoint blocked)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
