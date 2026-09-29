import type { PrismaClient } from "@strim/db";
import { writeAudit } from "../../lib/audit";
import type {
  BillingOverviewResult,
  BillingPlan,
  ChaosExperimentDto,
  CreateRetentionPolicyInput,
  GenerateInvoiceResult,
  InvoiceDto,
  RetentionPolicyDto,
  RetentionPurgeResult,
  SsoConfigInput,
  SsoConfigResult,
  StartChaosInput,
} from "./types";

export async function getBillingOverview(
  db: PrismaClient,
  organizationId: string,
): Promise<BillingOverviewResult> {
  let account = await db.billingAccount.findUnique({
    where: { organizationId },
    include: { invoices: { orderBy: { periodEnd: "desc" } } },
  });

  if (!account) {
    account = await db.billingAccount.create({
      data: { organizationId, plan: "team" },
      include: { invoices: true },
    });
  }

  const usage = await db.usageEvent.groupBy({
    by: ["metric"],
    where: { organizationId },
    _sum: { quantity: true },
  });

  return { account, usage };
}

export async function generateInvoice(
  db: PrismaClient,
  organizationId: string,
): Promise<GenerateInvoiceResult> {
  let account = await db.billingAccount.findUnique({ where: { organizationId } });
  if (!account) {
    account = await db.billingAccount.create({
      data: { organizationId, plan: "team" },
    });
  }

  const usage = await db.usageEvent.aggregate({
    where: { organizationId, metric: "telemetry_events" },
    _sum: { quantity: true },
  });

  const events = usage._sum.quantity ?? 0;
  const amountCents = Math.round(2900 + events * 0.01);

  const invoice = await db.invoice.create({
    data: {
      accountId: account.id,
      periodStart: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      periodEnd: new Date(),
      amountCents,
      status: "open",
    },
  });

  return invoice;
}

export async function listInvoices(
  db: PrismaClient,
  organizationId: string,
): Promise<InvoiceDto[]> {
  const account = await db.billingAccount.findUnique({
    where: { organizationId },
    include: { invoices: { orderBy: { periodEnd: "desc" } } },
  });

  return account?.invoices ?? [];
}

export async function updatePlan(
  db: PrismaClient,
  organizationId: string,
  plan: BillingPlan,
): Promise<{ plan: string }> {
  const account = await db.billingAccount.upsert({
    where: { organizationId },
    update: { plan },
    create: { organizationId, plan },
  });

  return { plan: account.plan };
}

export async function listRetentionPolicies(
  db: PrismaClient,
  organizationId: string,
): Promise<RetentionPolicyDto[]> {
  return db.retentionPolicy.findMany({
    where: { organizationId },
    orderBy: { dataClass: "asc" },
  });
}

export async function createRetentionPolicy(
  db: PrismaClient,
  organizationId: string,
  input: CreateRetentionPolicyInput,
): Promise<RetentionPolicyDto> {
  if (input.dataClass === "audit" && input.days < 365) {
    throw new Error("AUDIT_RETENTION_FLOOR_BREACH");
  }

  const existing = await db.retentionPolicy.findFirst({
    where: { organizationId, dataClass: input.dataClass },
  });

  if (existing) {
    return db.retentionPolicy.update({
      where: { id: existing.id },
      data: { days: input.days },
    });
  }

  return db.retentionPolicy.create({
    data: {
      organizationId,
      dataClass: input.dataClass,
      days: input.days,
    },
  });
}

export async function purgeRetention(
  db: PrismaClient,
  organizationId: string,
  actorId?: string,
): Promise<RetentionPurgeResult> {
  const policies = await db.retentionPolicy.findMany({ where: { organizationId } });
  const purged: string[] = [];

  for (const p of policies) {
    if (p.dataClass === "audit") continue;

    if (p.dataClass === "request_payloads") {
      const cutoff = new Date(Date.now() - p.days * 86400000);
      await db.requestRecord.deleteMany({
        where: { organizationId, createdAt: { lt: cutoff } },
      });
      purged.push(p.dataClass);
    }
  }

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "retention.purge",
    resourceType: "retention",
    newValue: { purged },
  });

  return { purged };
}

export async function getSsoConfig(
  db: PrismaClient,
  organizationId: string,
): Promise<SsoConfigResult> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
  });

  return {
    provider: org?.ssoProvider ?? null,
    configured: Boolean(org?.ssoProvider),
    ssoConfig: (org?.ssoConfig as Record<string, unknown>) ?? null,
    note: "Auth port is SSO-ready; complete IdP handshake in production.",
  };
}

export async function updateSsoConfig(
  db: PrismaClient,
  organizationId: string,
  input: SsoConfigInput,
  actorId?: string,
): Promise<SsoConfigResult> {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: {
      ssoProvider: input.provider,
      ssoConfig: input.config as object,
    },
  });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "sso.update",
    resourceType: "sso",
    newValue: { provider: input.provider },
  });

  return {
    provider: org.ssoProvider,
    configured: true,
    ssoConfig: org.ssoConfig as Record<string, unknown>,
    note: "Auth port is SSO-ready; complete IdP handshake in production.",
  };
}

export async function listChaosExperiments(
  db: PrismaClient,
  organizationId: string,
  environmentId?: string,
): Promise<ChaosExperimentDto[]> {
  return db.chaosExperiment.findMany({
    where: {
      organizationId,
      ...(environmentId ? { environmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function startChaosExperiment(
  db: PrismaClient,
  organizationId: string,
  input: StartChaosInput,
  userRole?: string,
  userId?: string,
): Promise<ChaosExperimentDto> {
  const env = await db.environment.findFirst({
    where: { id: input.environmentId, organizationId },
  });

  if (!env) {
    throw new Error("ENVIRONMENT_NOT_FOUND");
  }

  if (env.type === "PRODUCTION" && userRole !== "OWNER" && userRole !== "ADMIN") {
    throw new Error("FORBIDDEN_PRODUCTION_CHAOS");
  }

  const exp = await db.chaosExperiment.create({
    data: {
      organizationId,
      environmentId: input.environmentId,
      kind: input.kind,
      target: input.target,
      status: "running",
    },
  });

  await writeAudit(db, {
    organizationId,
    actorId: userId,
    action: "chaos.start",
    resourceType: "chaos",
    resourceId: exp.id,
    environmentId: input.environmentId,
    newValue: input,
  });

  return exp;
}

export async function revertChaosExperiment(
  db: PrismaClient,
  organizationId: string,
  experimentId: string,
  userId?: string,
): Promise<ChaosExperimentDto> {
  const existing = await db.chaosExperiment.findFirst({
    where: { id: experimentId, organizationId },
  });

  if (!existing) {
    throw new Error("EXPERIMENT_NOT_FOUND");
  }

  const exp = await db.chaosExperiment.update({
    where: { id: experimentId },
    data: {
      status: "reverted",
      revertedAt: new Date(),
    },
  });

  await writeAudit(db, {
    organizationId,
    actorId: userId,
    action: "chaos.revert",
    resourceType: "chaos",
    resourceId: exp.id,
    environmentId: exp.environmentId,
  });

  return exp;
}
