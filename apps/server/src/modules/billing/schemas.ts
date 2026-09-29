import { z } from "@hono/zod-openapi";

export const InvoiceSchema = z.object({
  id: z.string().openapi({ example: "inv_123abc" }),
  accountId: z.string().openapi({ example: "bill_acc_123" }),
  periodStart: z.union([z.string().datetime(), z.date()]).openapi({ example: "2026-08-30T00:00:00.000Z" }),
  periodEnd: z.union([z.string().datetime(), z.date()]).openapi({ example: "2026-09-29T23:59:59.000Z" }),
  amountCents: z.number().int().openapi({ example: 4500 }),
  status: z.string().openapi({ example: "open" }),
}).openapi({
  title: "Invoice",
});

export const BillingAccountSchema = z.object({
  id: z.string().openapi({ example: "bill_acc_123" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  plan: z.string().openapi({ example: "team" }),
  invoices: z.array(InvoiceSchema).optional(),
}).openapi({
  title: "BillingAccount",
});

export const UsageMetricSchema = z.object({
  metric: z.string().openapi({ example: "telemetry_events" }),
  _sum: z.object({
    quantity: z.number().nullable().openapi({ example: 160000 }),
  }),
}).openapi({
  title: "UsageMetric",
});

export const BillingOverviewResponseSchema = z.object({
  account: BillingAccountSchema.nullable(),
  usage: z.array(UsageMetricSchema),
}).openapi({
  title: "BillingOverviewResponse",
});

export const UpdatePlanSchema = z.object({
  plan: z.enum(["starter", "team", "enterprise"]).openapi({ example: "enterprise" }),
}).openapi({
  title: "UpdatePlanRequest",
});

export const ListInvoicesResponseSchema = z.object({
  invoices: z.array(InvoiceSchema),
}).openapi({
  title: "ListInvoicesResponse",
});

export const CreateRetentionPolicySchema = z.object({
  dataClass: z.string().min(1).openapi({ example: "request_payloads", description: "Category of telemetry data (e.g., request_payloads, audit, traces)" }),
  days: z.number().int().min(30).openapi({ example: 90, description: "Retention window in days (must be >= 30, and >= 365 for audit)" }),
}).openapi({
  title: "CreateRetentionPolicyRequest",
});

export const RetentionPolicySchema = z.object({
  id: z.string().openapi({ example: "ret_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  dataClass: z.string().openapi({ example: "request_payloads" }),
  days: z.number().int().openapi({ example: 90 }),
}).openapi({
  title: "RetentionPolicy",
});

export const ListRetentionPoliciesResponseSchema = z.object({
  policies: z.array(RetentionPolicySchema),
}).openapi({
  title: "ListRetentionPoliciesResponse",
});

export const PurgeRetentionResponseSchema = z.object({
  purged: z.array(z.string()).openapi({ example: ["request_payloads"] }),
}).openapi({
  title: "PurgeRetentionResponse",
});

export const SsoProviderEnum = z.enum(["oidc", "saml", "scim"]);

export const UpdateSsoSchema = z.object({
  provider: SsoProviderEnum.openapi({ example: "oidc" }),
  config: z.record(z.unknown()).openapi({ example: { issuer: "https://auth.company.com", clientId: "client_123" } }),
}).openapi({
  title: "UpdateSsoRequest",
});

export const SsoResponseSchema = z.object({
  provider: z.string().nullable().openapi({ example: "oidc" }),
  configured: z.boolean().openapi({ example: true }),
  note: z.string().openapi({ example: "Auth port is SSO-ready; complete IdP handshake in production." }),
  ssoConfig: z.record(z.unknown()).optional(),
}).openapi({
  title: "SsoResponse",
});

export const ChaosKindEnum = z.enum([
  "latency",
  "error",
  "timeout",
  "cache_unavailable",
  "partial_failure",
  "traffic_spike",
]);

export const StartChaosSchema = z.object({
  environmentId: z.string().openapi({ example: "env_prod_abc123" }),
  kind: ChaosKindEnum.openapi({ example: "latency" }),
  target: z.string().openapi({ example: "checkout-service" }),
}).openapi({
  title: "StartChaosRequest",
});

export const ChaosExperimentSchema = z.object({
  id: z.string().openapi({ example: "exp_123abc" }),
  organizationId: z.string().openapi({ example: "org_acme_prod" }),
  environmentId: z.string().openapi({ example: "env_prod_abc123" }),
  kind: z.string().openapi({ example: "latency" }),
  target: z.string().openapi({ example: "checkout-service" }),
  status: z.string().openapi({ example: "running" }),
  revertedAt: z.union([z.string().datetime(), z.date()]).nullable().openapi({ example: null }),
  createdAt: z.union([z.string().datetime(), z.date()]).openapi({ example: "2026-09-29T22:30:00.000Z" }),
}).openapi({
  title: "ChaosExperiment",
});

export const ListChaosExperimentsResponseSchema = z.object({
  experiments: z.array(ChaosExperimentSchema),
}).openapi({
  title: "ListChaosExperimentsResponse",
});

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "NOT_FOUND" }),
  message: z.string().optional().openapi({ example: "Resource not found" }),
}).openapi({
  title: "BillingErrorResponse",
});
