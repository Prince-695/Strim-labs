import type { PrismaClient } from "@strim/db";
import { diffRuntimeState } from "@strim/shared";
import { writeAudit } from "../../lib/audit";
import type {
  CheckDriftInput,
  CreatePolicyInput,
  CreatePromotionInput,
  CreateRateLimitInput,
  DriftAction,
  UpdatePolicyInput,
  UpdateRateLimitInput,
} from "./types";

export async function createPolicy(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  input: CreatePolicyInput,
) {
  const policy = await db.policy.create({
    data: {
      organizationId,
      kind: input.kind,
      name: input.name,
      environmentId: input.environmentId,
      body: input.body as object,
    },
  });

  await db.policyVersion.create({
    data: {
      policyId: policy.id,
      body: input.body as object,
      actorId,
    },
  });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "policy.create",
    resourceType: "policy",
    resourceId: policy.id,
    newValue: input,
  });

  return policy;
}

export async function listPolicies(db: PrismaClient, organizationId: string) {
  return db.policy.findMany({
    where: { organizationId },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
}

export async function getPolicy(db: PrismaClient, organizationId: string, id: string) {
  const policy = await db.policy.findFirst({
    where: { id, organizationId },
    include: { versions: { orderBy: { createdAt: "desc" } } },
  });

  if (!policy) throw new Error("POLICY_NOT_FOUND");
  return policy;
}

export async function updatePolicy(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
  input: UpdatePolicyInput,
) {
  const existing = await db.policy.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("POLICY_NOT_FOUND");

  const updated = await db.policy.update({
    where: { id },
    data: {
      name: input.name ?? existing.name,
      environmentId: input.environmentId ?? existing.environmentId,
      body: (input.body ? (input.body as object) : existing.body) as object,
    },
  });

  if (input.body) {
    await db.policyVersion.create({
      data: { policyId: id, body: input.body as object, actorId },
    });
  }

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "policy.update",
    resourceType: "policy",
    resourceId: id,
    oldValue: existing,
    newValue: updated,
  });

  return updated;
}

export async function deletePolicy(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  const existing = await db.policy.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("POLICY_NOT_FOUND");

  await db.policyVersion.deleteMany({ where: { policyId: id } });
  await db.policy.delete({ where: { id } });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "policy.delete",
    resourceType: "policy",
    resourceId: id,
    oldValue: existing,
  });

  return { ok: true };
}

export async function createRateLimit(
  db: PrismaClient,
  organizationId: string,
  input: CreateRateLimitInput,
) {
  return db.rateLimit.create({
    data: {
      organizationId,
      scope: input.scope,
      scopeId: input.scopeId,
      limit: input.limit,
      windowSeconds: input.windowSeconds ?? 60,
    },
  });
}

export async function listRateLimits(db: PrismaClient, organizationId: string) {
  return db.rateLimit.findMany({
    where: { organizationId },
  });
}

export async function updateRateLimit(
  db: PrismaClient,
  organizationId: string,
  id: string,
  input: UpdateRateLimitInput,
) {
  const existing = await db.rateLimit.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("RATE_LIMIT_NOT_FOUND");

  return db.rateLimit.update({
    where: { id },
    data: input,
  });
}

export async function deleteRateLimit(db: PrismaClient, organizationId: string, id: string) {
  const existing = await db.rateLimit.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("RATE_LIMIT_NOT_FOUND");

  await db.rateLimit.delete({ where: { id } });
  return { ok: true };
}

export async function evaluateRateLimit(
  db: PrismaClient,
  organizationId: string,
  applicationId?: string,
) {
  const limits = await db.rateLimit.findMany({
    where: { organizationId },
  });

  const specificity = [
    "endpoint",
    "api_key",
    "user",
    "ip",
    "environment",
    "application",
    "workspace",
    "organization",
  ];

  const sorted = [...limits].sort(
    (a, b) => specificity.indexOf(a.scope) - specificity.indexOf(b.scope),
  );

  const match =
    sorted.find((l) => l.scope === "application" && l.scopeId === applicationId) ??
    sorted.find((l) => l.scope === "organization") ??
    null;

  return { applied: match };
}

export async function createPromotion(
  db: PrismaClient,
  organizationId: string,
  input: CreatePromotionInput,
) {
  if (input.requireSimulation) {
    const sim = await db.simulation.findFirst({
      where: { environmentId: input.fromEnvId, organizationId, status: "completed" },
    });
    if (!sim) {
      throw new Error("SIMULATION_REQUIRED: Promotion requires a passing simulation");
    }
  }

  const promo = await db.promotion.create({
    data: {
      organizationId,
      fromEnvId: input.fromEnvId,
      toEnvId: input.toEnvId,
      requireSimulation: input.requireSimulation ?? false,
      status: "completed",
    },
  });

  const fromVer = await db.runtimeVersion.findFirst({
    where: { environmentId: input.fromEnvId, approved: true },
    orderBy: { seq: "desc" },
  });

  if (fromVer) {
    const last = await db.runtimeVersion.findFirst({
      where: { environmentId: input.toEnvId },
      orderBy: { seq: "desc" },
    });

    await db.runtimeVersion.create({
      data: {
        organizationId,
        environmentId: input.toEnvId,
        seq: (last?.seq ?? 0) + 1,
        values: fromVer.values as object,
        approved: true,
      },
    });
  }

  return promo;
}

export async function checkDrift(
  db: PrismaClient,
  organizationId: string,
  input: CheckDriftInput,
) {
  const env = await db.environment.findFirst({
    where: { id: input.environmentId, organizationId },
  });
  if (!env) throw new Error("ENVIRONMENT_NOT_FOUND");

  const expected = (env.declaredState as Record<string, unknown>) ?? {};
  const diffs = diffRuntimeState(expected, input.actual);

  const report = await db.driftReport.create({
    data: {
      organizationId,
      environmentId: input.environmentId,
      expected: expected as object,
      actual: input.actual as object,
      status: diffs.length ? "open" : "clean",
    },
  });

  return {
    report,
    diffs,
    actions: ["inspect", "accept", "correct", "create_change_plan"],
  };
}

export async function listDriftReports(
  db: PrismaClient,
  organizationId: string,
  environmentId?: string,
) {
  return db.driftReport.findMany({
    where: {
      organizationId,
      ...(environmentId ? { environmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function remediateDrift(
  db: PrismaClient,
  organizationId: string,
  id: string,
  action: DriftAction,
) {
  const validActions: DriftAction[] = ["inspect", "accept", "correct", "create_change_plan"];
  if (!validActions.includes(action)) {
    throw new Error("INVALID_DRIFT_ACTION");
  }

  const existing = await db.driftReport.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("DRIFT_REPORT_NOT_FOUND");

  const report = await db.driftReport.update({
    where: { id },
    data: { status: action === "accept" || action === "correct" ? "resolved" : "open" },
  });

  return { report, action };
}
