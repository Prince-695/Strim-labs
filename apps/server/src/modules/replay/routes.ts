import { createRoute } from "@hono/zod-openapi";
import { CreateReplaySchema, ErrorResponseSchema, ReplayRecordSchema } from "./schemas";

const tags = ["Safe Replay"];

export const createReplayRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Execute safe request replay",
  description:
    "Triggers an asynchronous sanitized replay of captured request(s). Enforces RBAC permissions, dangerous operation blocking, and audit logging.",
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
