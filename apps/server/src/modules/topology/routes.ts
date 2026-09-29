import { createRoute } from "@hono/zod-openapi";
import {
  AnnotateTopologySchema,
  ErrorResponseSchema,
  TopologyEdgeSchema,
  TopologyGraphQuerySchema,
  TopologyGraphResponseSchema,
  TopologyQueryRequestSchema,
  TopologyQueryResultSchema,
} from "./schemas";

const tags = ["Service Topology & Blast Radius"];

export const getTopologyGraphRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Get service topology graph",
  description: "Returns auto-derived and manually annotated service dependency nodes and edges.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: TopologyGraphQuerySchema,
  },
  responses: {
    200: {
      description: "Service topology nodes and edges",
      content: { "application/json": { schema: TopologyGraphResponseSchema } },
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

export const annotateTopologyRoute = createRoute({
  method: "post",
  path: "/annotate",
  tags,
  summary: "Annotate service dependency",
  description: "Manually declares or overrides an explicit dependency edge between two services.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: { "application/json": { schema: AnnotateTopologySchema } },
    },
  },
  responses: {
    200: {
      description: "Upserted topology edge",
      content: { "application/json": { schema: TopologyEdgeSchema } },
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

export const queryTopologyRoute = createRoute({
  method: "get",
  path: "/query",
  tags,
  summary: "Query dependency or blast radius",
  description:
    "Traverses the service graph to evaluate what depends on a service, what breaks if it fails, or its blast radius.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: TopologyQueryRequestSchema,
  },
  responses: {
    200: {
      description: "Graph traversal result",
      content: { "application/json": { schema: TopologyQueryResultSchema } },
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
