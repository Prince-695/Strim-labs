import { createRoute, z } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  EvaluateIncidentResponseSchema,
  EvaluateIncidentSchema,
  IncidentDetailSchema,
  ListIncidentsResponseSchema,
  ListNotificationsResponseSchema,
  ResolveIncidentResponseSchema,
  RollbackIncidentResponseSchema,
} from "./schemas";

const tags = ["Incidents & Automated Rollback"];

const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Incident ID", example: "inc_123abc" }),
});

export const evaluateIncidentRoute = createRoute({
  method: "post",
  path: "/evaluate",
  tags,
  summary: "Evaluate anomaly detection & correlate contributing factors",
  description: "Evaluates real-time metrics against anomaly baseline (mean + 3*stddev). If breached, correlates recent change plans and generates an incident with ranked factors.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: EvaluateIncidentSchema } } },
  },
  responses: {
    200: { description: "Incident evaluation result", content: { "application/json": { schema: EvaluateIncidentResponseSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listIncidentsRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List incidents",
  description: "Returns active and resolved incidents with ranked factors and unified timeline events.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: z.object({ environmentId: z.string().optional() }),
  },
  responses: {
    200: { description: "List of incidents", content: { "application/json": { schema: ListIncidentsResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const getIncidentRoute = createRoute({
  method: "get",
  path: "/:id",
  tags,
  summary: "Get incident details with unified timeline",
  description: "Retrieves complete incident breakdown including ranked causal factors and correlated change plan.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Incident details", content: { "application/json": { schema: IncidentDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Incident not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const resolveIncidentRoute = createRoute({
  method: "post",
  path: "/:id/resolve",
  tags,
  summary: "Mark incident as resolved",
  description: "Closes the incident, sets resolution timestamp, and dispatches INCIDENT_RESOLVED event.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Incident resolved", content: { "application/json": { schema: ResolveIncidentResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Incident not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const rollbackIncidentRoute = createRoute({
  method: "post",
  path: "/:id/rollback",
  tags,
  summary: "Trigger instant 1-click rollback from incident",
  description: "Reverts the correlated change plan that triggered this incident back to its previous runtime version.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Correlated change plan rolled back", content: { "application/json": { schema: RollbackIncidentResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Incident not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    409: { description: "No correlated change plan attached", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listNotificationsRoute = createRoute({
  method: "get",
  path: "/notifications",
  tags,
  summary: "List incident alerts and notifications",
  description: "Returns in-app notifications and alert messages.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "List of notifications", content: { "application/json": { schema: ListNotificationsResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
