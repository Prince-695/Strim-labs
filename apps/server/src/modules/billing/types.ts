export type BillingPlan = "starter" | "team" | "enterprise";

export type InvoiceDto = {
  id: string;
  accountId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  amountCents: number;
  status: string;
};

export type BillingOverviewResult = {
  account: {
    id: string;
    organizationId: string;
    plan: string;
    invoices: InvoiceDto[];
  } | null;
  usage: {
    metric: string;
    _sum: {
      quantity: number | null;
    };
  }[];
};

export type GenerateInvoiceResult = InvoiceDto;

export type RetentionPolicyDto = {
  id: string;
  organizationId: string;
  dataClass: string;
  days: number;
};

export type CreateRetentionPolicyInput = {
  dataClass: string;
  days: number;
};

export type RetentionPurgeResult = {
  purged: string[];
};

export type SsoProvider = "oidc" | "saml" | "scim";

export type SsoConfigInput = {
  provider: SsoProvider;
  config: Record<string, unknown>;
};

export type SsoConfigResult = {
  provider: string | null;
  configured: boolean;
  ssoConfig?: Record<string, unknown> | null;
  note: string;
};

export type ChaosKind =
  | "latency"
  | "error"
  | "timeout"
  | "cache_unavailable"
  | "partial_failure"
  | "traffic_spike";

export type StartChaosInput = {
  environmentId: string;
  kind: ChaosKind;
  target: string;
};

export type ChaosExperimentDto = {
  id: string;
  organizationId: string;
  environmentId: string;
  kind: string;
  target: string;
  status: string;
  revertedAt: Date | string | null;
  createdAt: Date | string;
};
