import { createRoute, z } from "@hono/zod-openapi";
import {
  CheckDriftSchema,
  CreatePolicySchema,
  CreatePromotionSchema,
  CreateRateLimitSchema,
  DeletePolicyResponseSchema,
  DriftActionEnum,
  DriftActionResponseSchema,
  DriftCheckResponseSchema,
  ErrorResponseSchema,
  ListDriftReportsResponseSchema,
  ListPoliciesResponseSchema,
  ListRateLimitsResponseSchema,
  PolicyDetailSchema,
  PromotionDetailSchema,
  RateLimitDetailSchema,
  RateLimitEvaluateResponseSchema,
  UpdatePolicySchema,
  UpdateRateLimitSchema,
} from "./schemas";

const tags = ["Policies & Guardrails"];

const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Resource identifier", example: "pol_123abc" }),
});

const DriftActionParamSchema = z.object({
  id: z.string().openapi({ example: "dr_123abc" }),
  action: DriftActionEnum,
});

export const createPolicyRoute = createRoute({
  method: "post",
  path: "/",
  tags,
  summary: "Create policy & guardrail rule",
  description: "Creates an organizational governance policy or guardrail threshold with version tracking.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CreatePolicySchema } } },
  },
  responses: {
    201: { description: "Policy created", content: { "application/json": { schema: PolicyDetailSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listPoliciesRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "List policies",
  description: "Returns organization policies with their latest version snapshots.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "List of policies", content: { "application/json": { schema: ListPoliciesResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const getPolicyRoute = createRoute({
  method: "get",
  path: "/:id",
  tags,
  summary: "Get policy details",
  description: "Returns policy configuration and version history.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Policy details", content: { "application/json": { schema: PolicyDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Policy not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updatePolicyRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags,
  summary: "Update policy & append version snapshot",
  description: "Updates policy rules and appends a new immutable PolicyVersion record.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdatePolicySchema } } },
  },
  responses: {
    200: { description: "Policy updated", content: { "application/json": { schema: PolicyDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Policy not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deletePolicyRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags,
  summary: "Delete policy",
  description: "Deletes a policy and all associated version snapshots.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Policy deleted", content: { "application/json": { schema: DeletePolicyResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Policy not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createRateLimitRoute = createRoute({
  method: "post",
  path: "/rate-limits",
  tags,
  summary: "Create rate limit policy",
  description: "Defines a rate limit threshold applied at organization, workspace, application, environment, endpoint, or API key scope.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CreateRateLimitSchema } } },
  },
  responses: {
    201: { description: "Rate limit created", content: { "application/json": { schema: RateLimitDetailSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listRateLimitsRoute = createRoute({
  method: "get",
  path: "/rate-limits",
  tags,
  summary: "List rate limit policies",
  description: "Returns all active rate limits for the organization.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "List of rate limits", content: { "application/json": { schema: ListRateLimitsResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updateRateLimitRoute = createRoute({
  method: "patch",
  path: "/rate-limits/:id",
  tags,
  summary: "Update rate limit policy",
  description: "Updates quota limit or time window for an existing rate limit rule.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
    body: { content: { "application/json": { schema: UpdateRateLimitSchema } } },
  },
  responses: {
    200: { description: "Rate limit updated", content: { "application/json": { schema: RateLimitDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Rate limit not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deleteRateLimitRoute = createRoute({
  method: "delete",
  path: "/rate-limits/:id",
  tags,
  summary: "Delete rate limit policy",
  description: "Removes a rate limit policy.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Rate limit deleted", content: { "application/json": { schema: DeletePolicyResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Rate limit not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const evaluateRateLimitRoute = createRoute({
  method: "get",
  path: "/rate-limits/evaluate",
  tags,
  summary: "Evaluate hierarchical rate limit match",
  description: "Resolves the highest-priority rate limit matching an application / environment context.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: z.object({ applicationId: z.string().optional() }),
  },
  responses: {
    200: { description: "Evaluated rate limit match", content: { "application/json": { schema: RateLimitEvaluateResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createPromotionRoute = createRoute({
  method: "post",
  path: "/promotions",
  tags,
  summary: "Promote runtime state across environments",
  description: "Promotes approved runtime version from source environment (e.g. Staging) to target (e.g. Production), with optional simulation gating.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CreatePromotionSchema } } },
  },
  responses: {
    201: { description: "Promotion completed", content: { "application/json": { schema: PromotionDetailSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    409: { description: "Simulation required before promotion", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const checkDriftRoute = createRoute({
  method: "post",
  path: "/drift/check",
  tags,
  summary: "Check runtime drift against declared state",
  description: "Compares declared environment state against live actual state and creates an open drift report.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CheckDriftSchema } } },
  },
  responses: {
    200: { description: "Drift check evaluation", content: { "application/json": { schema: DriftCheckResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Environment not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listDriftReportsRoute = createRoute({
  method: "get",
  path: "/drift",
  tags,
  summary: "List configuration drift reports",
  description: "Returns drift reports for the organization with optional environment filter.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: z.object({ environmentId: z.string().optional() }),
  },
  responses: {
    200: { description: "List of drift reports", content: { "application/json": { schema: ListDriftReportsResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const remediateDriftRoute = createRoute({
  method: "post",
  path: "/drift/:id/:action",
  tags,
  summary: "Remediate configuration drift",
  description: "Executes a drift remediation action: inspect, accept, correct, or create_change_plan.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: DriftActionParamSchema },
  responses: {
    200: { description: "Drift action recorded", content: { "application/json": { schema: DriftActionResponseSchema } } },
    400: { description: "Invalid action", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Drift report not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
