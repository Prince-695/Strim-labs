import type { PrismaClient } from "@strim/db";
import { hmacSha256, safeCompare } from "../../lib/crypto";
import type {
  CiGateInput,
  CiGateResult,
  CreateDeploymentInput,
  CreatePagingIntegrationInput,
  LineageChainResult,
} from "./types";

export async function evaluateCiGate(
  db: PrismaClient,
  organizationId: string,
  input: CiGateInput,
): Promise<CiGateResult> {
  const plan = await db.changePlan.findFirst({
    where: { id: input.changePlanId, organizationId },
    include: { simulation: true },
  });

  if (!plan) throw new Error("CHANGE_PLAN_NOT_FOUND");

  const threshold = input.thresholdPct ?? 20;
  const fail = input.p95RegressionPct > threshold;

  return {
    result: fail ? "FAIL" : "PASS",
    reason: fail
      ? `P95 regression ${input.p95RegressionPct}% exceeds threshold of ${threshold}%`
      : `P95 regression ${input.p95RegressionPct}% is within acceptable threshold (<= ${threshold}%)`,
    changePlanId: plan.id,
  };
}

export async function createDeployment(
  db: PrismaClient,
  organizationId: string,
  input: CreateDeploymentInput,
) {
  const event = await db.deploymentEvent.create({
    data: {
      organizationId,
      environmentId: input.environmentId,
      source: input.source,
      sha: input.sha,
      metadata: (input.metadata ?? {}) as object,
    },
  });

  const last = await db.runtimeVersion.findFirst({
    where: { environmentId: input.environmentId },
    orderBy: { seq: "desc" },
  });

  if (last && input.sha) {
    const plan = await db.changePlan.findFirst({
      where: { environmentId: input.environmentId, gitCommit: input.sha },
    });
    if (plan) {
      await db.lineageLink.create({
        data: { changePlanId: plan.id, kind: "deployment", ref: event.id },
      });
    }
  }

  return { event, attributedRuntimeVersion: last?.id ?? null };
}

export async function listDeployments(
  db: PrismaClient,
  organizationId: string,
  environmentId?: string,
) {
  return db.deploymentEvent.findMany({
    where: {
      organizationId,
      ...(environmentId ? { environmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createPagingIntegration(
  db: PrismaClient,
  organizationId: string,
  input: CreatePagingIntegrationInput,
) {
  return db.pagingIntegration.create({
    data: {
      organizationId,
      provider: input.provider,
      config: input.config as object,
    },
  });
}

export async function listPagingIntegrations(db: PrismaClient, organizationId: string) {
  return db.pagingIntegration.findMany({
    where: { organizationId },
  });
}

export async function deletePagingIntegration(
  db: PrismaClient,
  organizationId: string,
  id: string,
) {
  const existing = await db.pagingIntegration.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("INTEGRATION_NOT_FOUND");

  await db.pagingIntegration.delete({ where: { id } });
  return { ok: true };
}

export async function getLineage(
  db: PrismaClient,
  organizationId: string,
  changePlanId: string,
): Promise<LineageChainResult> {
  const plan = await db.changePlan.findFirst({
    where: { id: changePlanId, organizationId },
    include: { lineageLinks: true, simulation: true, rollouts: true, incidents: true },
  });

  if (!plan) throw new Error("CHANGE_PLAN_NOT_FOUND");

  return {
    chain: [
      { step: "git_commit", ref: plan.gitCommit },
      { step: "deployment", refs: plan.lineageLinks.filter((l) => l.kind === "deployment") },
      { step: "runtime_change", id: plan.id },
      { step: "simulation", id: plan.simulationId },
      { step: "rollout", items: plan.rollouts },
      { step: "incidents", items: plan.incidents },
    ],
  };
}

export async function handleGithubWebhook(
  db: PrismaClient,
  organizationId: string | undefined,
  rawBody: string,
  signature: string | undefined,
) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret && signature) {
    const expected = `sha256=${hmacSha256(rawBody, secret)}`;
    if (!safeCompare(signature, expected)) {
      throw new Error("INVALID_GITHUB_SIGNATURE");
    }
  }

  let body: {
    repository?: { full_name: string };
    pull_request?: { number: number; head?: { sha: string; ref: string } };
    after?: string;
    ref?: string;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error("INVALID_JSON");
  }

  const sha = body.pull_request?.head?.sha ?? body.after;
  if (!sha) return { ok: true, ignored: true, reason: "No commit sha found", linked: false };

  const plan = await db.changePlan.findFirst({
    where: {
      organizationId: organizationId || undefined,
      OR: [
        ...(body.pull_request ? [{ gitPullRequest: String(body.pull_request.number) }] : []),
        ...(body.ref ? [{ gitBranch: body.ref.replace("refs/heads/", "") }] : []),
      ],
    },
  });

  if (plan) {
    await db.lineageLink.create({
      data: { changePlanId: plan.id, kind: "git_commit", ref: sha },
    });
    await db.changePlan.update({
      where: { id: plan.id },
      data: { gitCommit: sha, gitBranch: body.pull_request?.head?.ref ?? body.ref },
    });
  }

  return { ok: true, sha, linked: Boolean(plan) };
}
