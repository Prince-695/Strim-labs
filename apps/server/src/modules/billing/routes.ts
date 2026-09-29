import { createRoute, z } from "@hono/zod-openapi";
import {
  BillingOverviewResponseSchema,
  ChaosExperimentSchema,
  CreateRetentionPolicySchema,
  ErrorResponseSchema,
  InvoiceSchema,
  ListChaosExperimentsResponseSchema,
  ListInvoicesResponseSchema,
  ListRetentionPoliciesResponseSchema,
  PurgeRetentionResponseSchema,
  RetentionPolicySchema,
  SsoResponseSchema,
  StartChaosSchema,
  UpdatePlanSchema,
  UpdateSsoSchema,
} from "./schemas";

const billingTags = ["Billing & Subscriptions"];
const retentionTags = ["Data Retention & Compliance"];
const ssoTags = ["Enterprise SSO"];
const chaosTags = ["Chaos Engineering"];

const IdParamSchema = z.object({
  id: z.string().openapi({ description: "Chaos experiment identifier", example: "exp_123abc" }),
});

export const getBillingOverviewRoute = createRoute({
  method: "get",
  path: "/",
  tags: billingTags,
  summary: "Get billing overview and aggregated usage",
  description: "Returns the billing account subscription tier, recent invoices, and aggregated telemetry usage.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Billing overview details", content: { "application/json": { schema: BillingOverviewResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const generateInvoiceRoute = createRoute({
  method: "post",
  path: "/invoices/generate",
  tags: billingTags,
  summary: "Generate invoice for current billing cycle",
  description: "Calculates usage-based invoice from telemetry events ($29 base + $0.01 per telemetry event).",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    201: { description: "Invoice generated successfully", content: { "application/json": { schema: InvoiceSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listInvoicesRoute = createRoute({
  method: "get",
  path: "/invoices",
  tags: billingTags,
  summary: "List past invoices for organization",
  description: "Returns historical billing invoices ordered by period end date.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "List of invoices", content: { "application/json": { schema: ListInvoicesResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updatePlanRoute = createRoute({
  method: "patch",
  path: "/plan",
  tags: billingTags,
  summary: "Update subscription plan tier",
  description: "Modifies the billing account plan (starter, team, enterprise).",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: UpdatePlanSchema } } },
  },
  responses: {
    200: { description: "Plan updated", content: { "application/json": { schema: z.object({ plan: z.string() }) } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listRetentionPoliciesRoute = createRoute({
  method: "get",
  path: "/",
  tags: retentionTags,
  summary: "List retention policies for organization",
  description: "Returns active retention policies defining expiration windows per data category.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Retention policies", content: { "application/json": { schema: ListRetentionPoliciesResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createRetentionPolicyRoute = createRoute({
  method: "post",
  path: "/",
  tags: retentionTags,
  summary: "Create or update data retention policy",
  description: "Configures data retention window. Requires minimum 365-day statutory floor for audit records.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: CreateRetentionPolicySchema } } },
  },
  responses: {
    201: { description: "Retention policy saved", content: { "application/json": { schema: RetentionPolicySchema } } },
    400: { description: "Validation error (e.g., audit floor breach)", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const purgeRetentionRoute = createRoute({
  method: "post",
  path: "/purge",
  tags: retentionTags,
  summary: "Trigger compliance data purge",
  description: "Purges expired telemetry data exceeding retention window and records an immutable audit log entry.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Purge results summary", content: { "application/json": { schema: PurgeRetentionResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const getSsoConfigRoute = createRoute({
  method: "get",
  path: "/",
  tags: ssoTags,
  summary: "Get enterprise SSO configuration status",
  description: "Retrieves configured single sign-on provider and readiness status.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "SSO status and configuration", content: { "application/json": { schema: SsoResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updateSsoConfigRoute = createRoute({
  method: "put",
  path: "/",
  tags: ssoTags,
  summary: "Configure enterprise SSO provider",
  description: "Updates organization SSO provider (OIDC, SAML, SCIM) and connection parameters.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: UpdateSsoSchema } } },
  },
  responses: {
    200: { description: "SSO updated", content: { "application/json": { schema: SsoResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listChaosExperimentsRoute = createRoute({
  method: "get",
  path: "/",
  tags: chaosTags,
  summary: "List chaos engineering experiments",
  description: "Returns chaos injection experiments across environments.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    query: z.object({ environmentId: z.string().optional() }),
  },
  responses: {
    200: { description: "List of chaos experiments", content: { "application/json": { schema: ListChaosExperimentsResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const startChaosExperimentRoute = createRoute({
  method: "post",
  path: "/",
  tags: chaosTags,
  summary: "Start chaos engineering experiment",
  description: "Injects runtime fault (latency, error, timeout, cache_unavailable, partial_failure, traffic_spike). Production chaos requires OWNER or ADMIN role.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: StartChaosSchema } } },
  },
  responses: {
    201: { description: "Chaos experiment started", content: { "application/json": { schema: ChaosExperimentSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden (production tier restriction)", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Environment not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const revertChaosExperimentRoute = createRoute({
  method: "post",
  path: "/:id/revert",
  tags: chaosTags,
  summary: "Revert chaos experiment",
  description: "Immediately ceases injected runtime faults and returns target to normal operation.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    params: IdParamSchema,
  },
  responses: {
    200: { description: "Chaos experiment reverted", content: { "application/json": { schema: ChaosExperimentSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Experiment not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
