import { z } from "@hono/zod-openapi";

export const TopologyNodeSchema = z
  .object({
    id: z.string().openapi({ example: "node_123" }),
    organizationId: z.string().openapi({ example: "org_abc" }),
    environmentId: z.string().openapi({ example: "env_xyz" }),
    name: z.string().openapi({ example: "order-service" }),
    kind: z.string().openapi({ example: "service" }),
    manual: z.boolean().openapi({ example: false }),
  })
  .openapi("TopologyNode");

export const TopologyEdgeSchema = z
  .object({
    id: z.string().openapi({ example: "edge_456" }),
    organizationId: z.string().openapi({ example: "org_abc" }),
    environmentId: z.string().openapi({ example: "env_xyz" }),
    fromName: z.string().openapi({ example: "checkout-ui" }),
    toName: z.string().openapi({ example: "order-service" }),
    manual: z.boolean().openapi({ example: false }),
  })
  .openapi("TopologyEdge");

export const TopologyGraphQuerySchema = z.object({
  environmentId: z.string().openapi({
    description: "Environment identifier",
    example: "env_xyz",
  }),
});

export const TopologyGraphResponseSchema = z
  .object({
    nodes: z.array(TopologyNodeSchema),
    edges: z.array(TopologyEdgeSchema),
  })
  .openapi("TopologyGraphResponse");

export const AnnotateTopologySchema = z
  .object({
    environmentId: z.string().openapi({ example: "env_xyz" }),
    fromName: z.string().openapi({ example: "web-gateway" }),
    toName: z.string().openapi({ example: "auth-service" }),
  })
  .openapi("AnnotateTopologyInput");

export const TopologyQueryRequestSchema = z.object({
  environmentId: z.string().openapi({ example: "env_xyz" }),
  node: z.string().openapi({ description: "Target service name", example: "order-service" }),
  q: z
    .enum(["depends", "breaks", "blast"])
    .default("depends")
    .openapi({
      description: "Query type: depends (upstream), breaks (downstream impact), or blast (blast radius list)",
      example: "breaks",
    }),
});

export const TopologyQueryResultSchema = z
  .object({
    result: z.array(z.string()).openapi({
      description: "List of service names matching the graph query",
      example: ["checkout-ui", "payment-service"],
    }),
  })
  .openapi("TopologyQueryResult");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "VALIDATION" }),
    message: z.string().optional().openapi({ example: "Validation failed" }),
  })
  .openapi("ErrorResponse");
