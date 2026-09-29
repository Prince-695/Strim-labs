import { createRoute, z } from "@hono/zod-openapi";
import {
  CreateSimulationSchema,
  DeleteSimulationResponseSchema,
  ErrorResponseSchema,
  ListSimulationsQuerySchema,
  ListSimulationsResponseSchema,
  SimulationDetailSchema,
} from "./schemas";

const tags = ["Simulations & What-If Engine"];

const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Simulation ID", example: "sim_abc123xyz" }),
});

export const createSimulationRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Run What-If simulation comparing baseline vs proposed state",
  description:
    "Executes a sandboxed what-if scenario (traffic multiplier, cache on/off, timeout tuning, dependency latency/outage) against environment telemetry baseline. Calculates P95/P99 latency, error rate, origin RPS, and cache hit deltas, and validates performance gating.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateSimulationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Simulation executed with baseline vs experiment comparison and gate evaluation",
      content: { "application/json": { schema: SimulationDetailSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Forbidden (cannot simulate mutations against production)",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Target environment not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const listSimulationsRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List simulations",
  description: "Returns past what-if simulations, comparisons, and gating evaluations.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: ListSimulationsQuerySchema,
  },
  responses: {
    200: {
      description: "List of simulations",
      content: { "application/json": { schema: ListSimulationsResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const getSimulationRoute = createRoute({
  method: "get",
  path: "/:id",
  tags,
  summary: "Get simulation details, deltas, and gating evaluation",
  description: "Retrieves complete baseline metrics, experiment metrics, metric deltas, and change plan gate evaluation.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: "Detailed simulation report",
      content: { "application/json": { schema: SimulationDetailSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Simulation not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

export const deleteSimulationRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags,
  summary: "Delete simulation record",
  description: "Removes a simulation record from the environment.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: {
      description: "Simulation deleted response",
      content: { "application/json": { schema: DeleteSimulationResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Simulation not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
