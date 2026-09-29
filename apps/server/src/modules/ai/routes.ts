import { createRoute, z } from "@hono/zod-openapi";
import {
  AiQueryRequestSchema,
  AiQueryResponseSchema,
  ErrorResponseSchema,
  ListAiQueriesResponseSchema,
} from "./schemas";

const tags = ["AI Copilot & Intelligence"];

export const executeQueryRoute = createRoute({
  method: "post",
  path: "/query",
  tags,
  summary: "Ask natural language question grounded in the tenant's Runtime Model",
  description: "Parses canonical questions (what changed, why slow, what if, cache safe), gathers tenant-scoped context, applies causality hedging, and returns verified citations.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: AiQueryRequestSchema } } },
  },
  responses: {
    200: { description: "Grounded answer with citations and uncertainty notice", content: { "application/json": { schema: AiQueryResponseSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listQueryLogsRoute = createRoute({
  method: "get",
  path: "/queries",
  tags,
  summary: "List recent AI assistant queries & citations",
  description: "Returns past questions asked by team members in this tenant along with answers and citations.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: z.object({ limit: z.coerce.number().optional() }),
  },
  responses: {
    200: { description: "List of past queries", content: { "application/json": { schema: ListAiQueriesResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
