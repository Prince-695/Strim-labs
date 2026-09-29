import { createRoute, z } from "@hono/zod-openapi";
import {
  ApproveChangePlanSchema,
  ChangePlanDetailSchema,
  CreateChangePlanSchema,
  DeleteChangePlanResponseSchema,
  ErrorResponseSchema,
  GuardrailCheckResponseSchema,
  GuardrailCheckSchema,
  ListChangePlansQuerySchema,
  ListChangePlansResponseSchema,
  UpdateChangePlanSchema,
} from "./schemas";

const tags = ["Change Plans & Controlled Rollout"];

const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Change plan ID", example: "cplan_123abc" }),
});

export const createChangePlanRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Create change plan with proposed runtime version & blast radius",
  description: "Creates an immutable proposed Runtime Version, evaluates blast radius and explainable risk score, and initializes change plan in DRAFT state.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CreateChangePlanSchema } } },
  },
  responses: {
    201: { description: "Change plan created", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listChangePlansRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List change plans",
  description: "Returns change plans for the active organization with optional environment filter.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { query: ListChangePlansQuerySchema },
  responses: {
    200: { description: "List of change plans", content: { "application/json": { schema: ListChangePlansResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const getChangePlanRoute = createRoute({
  method: "get",
  path: "/:id",
  tags,
  summary: "Get change plan details, approvals, and rollout state",
  description: "Retrieves complete change plan lifecycle state, blast radius, risk factors, simulation status, and approvals.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Change plan details", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updateChangePlanRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags,
  summary: "Update change plan metadata",
  description: "Updates change plan title, description, or Git lineage. Blocked if plan is already approved or rolling out.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateChangePlanSchema } } },
  },
  responses: {
    200: { description: "Change plan updated", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    409: { description: "Conflict - cannot edit in-flight plan", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deleteChangePlanRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags,
  summary: "Delete change plan",
  description: "Deletes a draft or rejected change plan along with associated approvals and transitions.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Change plan deleted", content: { "application/json": { schema: DeleteChangePlanResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    409: { description: "Conflict - cannot delete active rollout", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const simulateChangePlanRoute = createRoute({
  method: "post",
  path: "/:id/simulate",
  tags,
  summary: "Run What-If simulation comparing baseline vs proposed state",
  description: "Transitions change plan through VALIDATING → SIMULATION_PENDING → SIMULATING and executes What-If simulation.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Simulation completed", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const approveChangePlanRoute = createRoute({
  method: "post",
  path: "/:id/approve",
  tags,
  summary: "Approve change plan for rollout",
  description: "Approves change plan for rollout. Enforces FR-9.10.1: SIMULATION_FAILED plans require an audited override justification.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: ApproveChangePlanSchema } } },
  },
  responses: {
    200: { description: "Approved", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
    409: { description: "Conflict / cannot approve", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const rejectChangePlanRoute = createRoute({
  method: "post",
  path: "/:id/reject",
  tags,
  summary: "Reject change plan",
  description: "Rejects change plan and transitions state to REJECTED.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Rejected", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const rolloutChangePlanRoute = createRoute({
  method: "post",
  path: "/:id/rollout",
  tags,
  summary: "Advance canary rollout stage (10% -> 25% -> 50% -> 100%)",
  description: "Steps rollout percentage through configured canary stages. At 100%, marks proposed version as approved and plan as COMPLETED.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Rollout stage advanced", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const guardrailCheckRoute = createRoute({
  method: "post",
  path: "/:id/guardrail-check",
  tags,
  summary: "Evaluate automated guardrails during rollout",
  description: "Checks real-time or supplied error rate, latency, and availability. Automatically pauses (P95 > 2000ms) or triggers rollback (error rate > 5%).",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: GuardrailCheckSchema } } },
  },
  responses: {
    200: { description: "Guardrail evaluation result", content: { "application/json": { schema: GuardrailCheckResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const rollbackChangePlanRoute = createRoute({
  method: "post",
  path: "/:id/rollback",
  tags,
  summary: "Instant 1-click rollback to previous Runtime Version",
  description: "Immediately reverts to prior Runtime Version, records Rollback event, and marks plan state ROLLED_BACK.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Rolled back successfully", content: { "application/json": { schema: ChangePlanDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Change plan not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
