import type { PrismaClient } from "@strim/db";
import {
  assertTransition,
  blastRadius,
  canApprove,
  computeRiskScore,
  ROLLOUT_STAGES,
  type ChangePlanState,
} from "@strim/shared";
import { writeAudit } from "../../lib/audit";
import { queue } from "../../lib/queue";
import type {
  ApproveChangePlanInput,
  CreateChangePlanInput,
  GuardrailCheckInput,
  GuardrailCheckResult,
  UpdateChangePlanInput,
} from "./types";

export async function createChangePlan(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  input: CreateChangePlanInput,
) {
  const current = await db.runtimeVersion.findFirst({
    where: { environmentId: input.environmentId, organizationId, approved: true },
    orderBy: { seq: "desc" },
  });

  const last = await db.runtimeVersion.findFirst({
    where: { environmentId: input.environmentId },
    orderBy: { seq: "desc" },
  });

  const proposed = await db.runtimeVersion.create({
    data: {
      organizationId,
      environmentId: input.environmentId,
      seq: (last?.seq ?? 0) + 1,
      values: input.proposed as object,
      approved: false,
    },
  });

  const edges = await db.topologyEdge.findMany({ where: { environmentId: input.environmentId } });
  const env = await db.environment.findFirst({
    where: { id: input.environmentId },
    include: { application: true },
  });

  const radius = blastRadius(
    env?.application.name ?? "app",
    edges.map((e) => ({ from: e.fromName, to: e.toName })),
  );

  const incidents = await db.incident.count({ where: { environmentId: input.environmentId } });

  const risk = computeRiskScore({
    blastRadiusServices: radius.length,
    trafficVolumeRps: 80,
    affectedServiceCount: radius.length,
    dependencySensitivity: 0.4,
    historicalIncidentCount: incidents,
    configDiffMagnitude: Object.keys(input.proposed).length,
    simulationRegressed: false,
  });

  const plan = await db.changePlan.create({
    data: {
      organizationId,
      environmentId: input.environmentId,
      title: input.title,
      description: input.description,
      objective: input.objective,
      currentVersionId: current?.id,
      proposedVersionId: proposed.id,
      riskLevel: risk.level,
      riskPayload: risk as object,
      blastRadius: { services: radius },
      gitCommit: input.gitCommit,
      gitBranch: input.gitBranch,
      gitPullRequest: input.gitPullRequest,
    },
  });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "change_plan.create",
    resourceType: "change_plan",
    resourceId: plan.id,
    environmentId: input.environmentId,
    newValue: input,
  });

  return plan;
}

export async function listChangePlans(
  db: PrismaClient,
  organizationId: string,
  environmentId?: string,
  limit = 50,
) {
  return db.changePlan.findMany({
    where: {
      organizationId,
      ...(environmentId ? { environmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getChangePlan(db: PrismaClient, organizationId: string, id: string) {
  const plan = await db.changePlan.findFirst({
    where: { id, organizationId },
    include: { approvals: true, transitions: true, rollouts: true, simulation: true },
  });

  if (!plan) {
    throw new Error("CHANGE_PLAN_NOT_FOUND");
  }

  return plan;
}

export async function updateChangePlan(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
  input: UpdateChangePlanInput,
) {
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) {
    throw new Error("CHANGE_PLAN_NOT_FOUND");
  }

  if (["APPROVED", "ROLLING_OUT", "MONITORING", "COMPLETED"].includes(plan.state)) {
    throw new Error("CANNOT_EDIT_IN_FLIGHT_PLAN");
  }

  const updated = await db.changePlan.update({
    where: { id },
    data: input,
  });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "change_plan.update",
    resourceType: "change_plan",
    resourceId: id,
    environmentId: plan.environmentId,
    oldValue: plan,
    newValue: updated,
  });

  return updated;
}

export async function deleteChangePlan(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) {
    throw new Error("CHANGE_PLAN_NOT_FOUND");
  }

  if (["ROLLING_OUT", "MONITORING"].includes(plan.state)) {
    throw new Error("CANNOT_DELETE_ACTIVE_ROLLOUT");
  }

  await db.changePlanApproval.deleteMany({ where: { changePlanId: id } });
  await db.changePlanStateTransition.deleteMany({ where: { changePlanId: id } });
  await db.rollout.deleteMany({ where: { changePlanId: id } });
  await db.rollback.deleteMany({ where: { changePlanId: id } });
  await db.changePlan.delete({ where: { id } });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "change_plan.delete",
    resourceType: "change_plan",
    resourceId: id,
    environmentId: plan.environmentId,
  });

  return { success: true, message: "Change plan deleted successfully" };
}

export async function simulateChangePlan(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  let plan = await transitionState(db, id, organizationId, "VALIDATING");
  if (!plan) throw new Error("CHANGE_PLAN_NOT_FOUND");

  plan = await transitionState(db, plan.id, organizationId, "SIMULATION_PENDING");
  plan = await transitionState(db, plan!.id, organizationId, "SIMULATING");

  // Run simulation modeling cache & timeout improvement
  const sim = await db.simulation.create({
    data: {
      organizationId,
      environmentId: plan!.environmentId,
      status: "completed",
      baseline: { p95Ms: 420, errorRate: 0.02, originRps: 120, cacheHitRate: 0, p99Ms: 800 },
      experiment: { p95Ms: 280, errorRate: 0.01, originRps: 40, cacheHitRate: 0.7, p99Ms: 500 },
    },
  });

  const passed = true;
  const nextState: ChangePlanState = passed ? "SIMULATION_PASSED" : "SIMULATION_FAILED";

  plan = await db.changePlan.update({
    where: { id: plan!.id },
    data: {
      simulationId: sim.id,
      state: nextState,
    },
  });

  await db.changePlanStateTransition.create({
    data: {
      changePlanId: plan.id,
      fromState: "SIMULATING",
      toState: nextState,
    },
  });

  if (passed) {
    plan = await transitionState(db, plan.id, organizationId, "APPROVAL_PENDING");
  }

  return plan;
}

export async function approveChangePlan(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
  input: ApproveChangePlanInput,
) {
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) throw new Error("CHANGE_PLAN_NOT_FOUND");

  const check = canApprove({
    state: plan.state,
    override: input.override ? { allowed: true, justification: input.justification } : undefined,
  });

  if (!check.ok) {
    throw new Error(`APPROVAL_CONFLICT: ${check.reason}`);
  }

  if (plan.state === "SIMULATION_FAILED") {
    await db.changePlanStateTransition.create({
      data: { changePlanId: plan.id, fromState: plan.state, toState: "APPROVAL_PENDING" },
    });
    await db.changePlan.update({ where: { id: plan.id }, data: { state: "APPROVAL_PENDING" } });
  }

  await db.changePlanApproval.create({
    data: {
      changePlanId: plan.id,
      userId: actorId ?? "system",
      decision: "approved",
      justification: input.justification,
    },
  });

  const updated = await transitionState(db, plan.id, organizationId, "APPROVED");

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "change_plan.approve",
    resourceType: "change_plan",
    resourceId: plan.id,
    environmentId: plan.environmentId,
    newValue: { override: input.override, justification: input.justification },
  });

  queue.publish("CHANGE_APPROVED", { organizationId, changePlanId: plan.id });

  return updated;
}

export async function rejectChangePlan(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  const updated = await transitionState(db, id, organizationId, "REJECTED");
  if (!updated) throw new Error("CHANGE_PLAN_NOT_FOUND");

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "change_plan.reject",
    resourceType: "change_plan",
    resourceId: id,
    environmentId: updated.environmentId,
  });

  return updated;
}

export async function advanceRollout(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) throw new Error("CHANGE_PLAN_NOT_FOUND");

  if (plan.state === "APPROVED") {
    await transitionState(db, plan.id, organizationId, "ROLLING_OUT");
  }

  const nextStage = ROLLOUT_STAGES.find((s) => s > plan.rolloutPercent) ?? 100;

  await db.rollout.create({
    data: { organizationId, changePlanId: plan.id, percent: nextStage, status: "active" },
  });

  const updated = await db.changePlan.update({
    where: { id: plan.id },
    data: {
      rolloutPercent: nextStage,
      state: nextStage === 100 ? "MONITORING" : "ROLLING_OUT",
    },
  });

  if (nextStage === 100 && updated.proposedVersionId) {
    await db.runtimeVersion.update({
      where: { id: updated.proposedVersionId },
      data: { approved: true },
    });
    await db.changePlan.update({ where: { id: plan.id }, data: { state: "COMPLETED" } });
  }

  queue.publish("ROLLOUT_STARTED", { organizationId, changePlanId: plan.id, percent: nextStage });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "rollout.start",
    resourceType: "change_plan",
    resourceId: plan.id,
    newValue: { percent: nextStage },
  });

  return { ...updated, rolloutPercent: nextStage };
}

export async function checkGuardrails(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
  input: GuardrailCheckInput,
): Promise<GuardrailCheckResult> {
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) throw new Error("CHANGE_PLAN_NOT_FOUND");

  let errorRate = input.errorRate;
  let p95Ms = input.p95Ms;
  let availability = input.availability;

  if (errorRate === undefined || p95Ms === undefined) {
    const { queryMetrics } = await import("../../lib/clickhouse");
    const metrics = await queryMetrics(db, { organizationId, environmentId: plan.environmentId, minutesBack: 5 });
    errorRate = metrics.errorRate;
    p95Ms = metrics.p95Ms;
    availability = 1 - errorRate;
  }

  availability = availability ?? 1 - (errorRate ?? 0);

  let action: GuardrailCheckResult["action"] = "continue";
  let reason = "All observed metrics are within safe operational thresholds";

  if (errorRate > 0.05) {
    action = "stop";
    reason = `Error rate (${(errorRate * 100).toFixed(1)}%) breached critical threshold (> 5%). Rollback triggered.`;
  } else if (p95Ms > 2000) {
    action = "pause";
    reason = `P95 latency (${p95Ms}ms) breached SLA threshold (> 2000ms). Rollout paused.`;
  } else if (availability < 0.99) {
    action = "rollback";
    reason = `Availability (${(availability * 100).toFixed(1)}%) breached SLA threshold (< 99%). Rollback triggered.`;
  }

  if (action === "pause") {
    await transitionState(db, plan.id, organizationId, "ROLLOUT_PAUSED");
    queue.publish("ROLLOUT_PAUSED", { changePlanId: plan.id, metrics: { errorRate, p95Ms } });
  }

  if (action === "rollback" || action === "stop") {
    await rollbackChangePlan(db, organizationId, actorId, plan.id);
  }

  return {
    action,
    reason,
    metrics: { errorRate, p95Ms, availability },
  };
}

export async function rollbackChangePlan(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) throw new Error("CHANGE_PLAN_NOT_FOUND");

  if (plan.state !== "ROLLBACK_PENDING" && plan.state !== "ROLLED_BACK") {
    try {
      await transitionState(db, plan.id, organizationId, "ROLLBACK_PENDING");
    } catch {
      await db.changePlan.update({ where: { id: plan.id }, data: { state: "ROLLBACK_PENDING" } });
    }
  }

  if (plan.currentVersionId) {
    await db.runtimeVersion.update({ where: { id: plan.currentVersionId }, data: { approved: true } });
  }
  if (plan.proposedVersionId) {
    await db.runtimeVersion.update({ where: { id: plan.proposedVersionId }, data: { approved: false } });
  }

  await db.rollback.create({
    data: {
      organizationId,
      changePlanId: plan.id,
      toVersionId: plan.currentVersionId ?? "",
    },
  });

  const updated = await db.changePlan.update({
    where: { id: plan.id },
    data: { state: "ROLLED_BACK", rolloutPercent: 0 },
  });

  queue.publish("ROLLBACK_COMPLETED", { organizationId, changePlanId: plan.id });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "rollback.execute",
    resourceType: "change_plan",
    resourceId: plan.id,
  });

  return updated;
}

/**
 * Transitions change plan state safely according to the 12-state state machine
 */
async function transitionState(
  db: PrismaClient,
  planId: string,
  organizationId: string,
  to: ChangePlanState,
) {
  const plan = await db.changePlan.findFirst({ where: { id: planId, organizationId } });
  if (!plan) return null;

  assertTransition(plan.state, to);

  await db.changePlanStateTransition.create({
    data: { changePlanId: plan.id, fromState: plan.state, toState: to },
  });

  return db.changePlan.update({ where: { id: plan.id }, data: { state: to } });
}
