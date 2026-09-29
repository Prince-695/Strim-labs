import { createRoute, z } from "@hono/zod-openapi";
import {
  CiGateResponseSchema,
  CiGateSchema,
  CreateDeploymentResponseSchema,
  CreateDeploymentSchema,
  CreatePagingSchema,
  DeleteIntegrationResponseSchema,
  ErrorResponseSchema,
  LineageResponseSchema,
  ListDeploymentsResponseSchema,
  ListPagingResponseSchema,
  PagingIntegrationSchema,
} from "./schemas";

const tags = ["Integrations & Lineage"];

const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Integration identifier", example: "page_123abc" }),
});

const ChangePlanIdParamSchema = z.object({
  changePlanId: z.string().openapi({ description: "Change plan identifier", example: "cplan_123abc" }),
});

export const ciGateRoute = createRoute({
  method: "post",
  path: "/ci/gate",
  tags,
  summary: "CI/CD pipeline simulation gate (API Key authenticated)",
  description: "Evaluates whether simulated latency or error regression breaches the PR merge threshold.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CiGateSchema } } },
  },
  responses: {
    200: { description: "Gate decision (PASS or FAIL)", content: { "application/json": { schema: CiGateResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createDeploymentRoute = createRoute({
  method: "post",
  path: "/deployments",
  tags,
  summary: "Record deployment event",
  description: "Tracks code deployment event, associates git commit SHA, and attributes runtime version lineage.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CreateDeploymentSchema } } },
  },
  responses: {
    201: { description: "Deployment event recorded", content: { "application/json": { schema: CreateDeploymentResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listDeploymentsRoute = createRoute({
  method: "get",
  path: "/deployments",
  tags,
  summary: "List deployment events",
  description: "Returns recent deployment events for the organization.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: z.object({ environmentId: z.string().optional() }),
  },
  responses: {
    200: { description: "List of deployment events", content: { "application/json": { schema: ListDeploymentsResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createPagingRoute = createRoute({
  method: "post",
  path: "/paging",
  tags,
  summary: "Configure paging integration",
  description: "Sets up alerting destination (PagerDuty, Slack, Opsgenie) for automatic incident escalation.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CreatePagingSchema } } },
  },
  responses: {
    201: { description: "Paging integration saved", content: { "application/json": { schema: PagingIntegrationSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listPagingRoute = createRoute({
  method: "get",
  path: "/paging",
  tags,
  summary: "List paging integrations",
  description: "Returns active incident notification channels.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "List of paging integrations", content: { "application/json": { schema: ListPagingResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deletePagingRoute = createRoute({
  method: "delete",
  path: "/paging/:id",
  tags,
  summary: "Delete paging integration",
  description: "Removes an alerting channel.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Integration deleted", content: { "application/json": { schema: DeleteIntegrationResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Integration not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const getLineageRoute = createRoute({
  method: "get",
  path: "/lineage/:changePlanId",
  tags,
  summary: "Get end-to-end change provenance lineage",
  description: "Traverses complete causal chain from Git commit → deployment event → runtime change → simulation → canary rollouts → incidents.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: ChangePlanIdParamSchema },
  responses: {
    200: { description: "Complete provenance chain", content: { "application/json": { schema: LineageResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
