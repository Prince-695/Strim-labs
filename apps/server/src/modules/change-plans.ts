import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  assertTransition,
  blastRadius,
  canApprove,
  computeRiskScore,
  ROLLOUT_STAGES,
  type ChangePlanState,
} from "@strim/shared";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { requireProductionTier } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { queue } from "../lib/queue";

export const changePlanRoutes = new Hono<AppEnv>();
changePlanRoutes.use("*", requireAuth, requireOrg);

changePlanRoutes.post("/", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      title: z.string(),
      description: z.string(),
      objective: z.string(),
      proposed: z.record(z.unknown()),
      gitCommit: z.string().optional(),
      gitBranch: z.string().optional(),
      gitPullRequest: z.string().optional(),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const current = await db.runtimeVersion.findFirst({
    where: { environmentId: body.environmentId, organizationId, approved: true },
    orderBy: { seq: "desc" },
  });
  const last = await db.runtimeVersion.findFirst({
    where: { environmentId: body.environmentId },
    orderBy: { seq: "desc" },
  });
  const proposed = await db.runtimeVersion.create({
    data: {
      organizationId,
      environmentId: body.environmentId,
      seq: (last?.seq ?? 0) + 1,
      values: body.proposed as object,
      approved: false,
    },
  });
  const edges = await db.topologyEdge.findMany({ where: { environmentId: body.environmentId } });
  const env = await db.environment.findFirst({
    where: { id: body.environmentId },
    include: { application: true },
  });
  const radius = blastRadius(
    env?.application.name ?? "app",
    edges.map((e) => ({ from: e.fromName, to: e.toName })),
  );
  const incidents = await db.incident.count({ where: { environmentId: body.environmentId } });
  const risk = computeRiskScore({
    blastRadiusServices: radius.length,
    trafficVolumeRps: 80,
    affectedServiceCount: radius.length,
    dependencySensitivity: 0.4,
    historicalIncidentCount: incidents,
    configDiffMagnitude: Object.keys(body.proposed).length,
    simulationRegressed: false,
  });
  const plan = await db.changePlan.create({
    data: {
      organizationId,
      environmentId: body.environmentId,
      title: body.title,
      description: body.description,
      objective: body.objective,
      currentVersionId: current?.id,
      proposedVersionId: proposed.id,
      riskLevel: risk.level,
      riskPayload: risk as object,
      blastRadius: { services: radius },
      gitCommit: body.gitCommit,
      gitBranch: body.gitBranch,
      gitPullRequest: body.gitPullRequest,
    },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "change_plan.create",
    resourceType: "change_plan",
    resourceId: plan.id,
    environmentId: body.environmentId,
    newValue: body,
  });
  return c.json(plan, 201);
});

changePlanRoutes.get("/", async (c) => {
  const plans = await c.get("db").changePlan.findMany({
    where: {
      organizationId: c.get("organizationId")!,
      environmentId: c.req.query("environmentId") || undefined,
    },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ changePlans: plans });
});

changePlanRoutes.get("/:id", async (c) => {
  const plan = await c.get("db").changePlan.findFirst({
    where: { id: c.req.param("id"), organizationId: c.get("organizationId")! },
    include: { approvals: true, transitions: true, rollouts: true, simulation: true },
  });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(plan);
});

async function transition(
  db: AppEnv["Variables"]["db"],
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

changePlanRoutes.post("/:id/simulate", async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  let plan = await transition(db, c.req.param("id"), organizationId, "VALIDATING");
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);
  plan = await transition(db, plan.id, organizationId, "SIMULATION_PENDING");
  plan = await transition(db, plan!.id, organizationId, "SIMULATING");
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
  plan = await db.changePlan.update({
    where: { id: plan!.id },
    data: {
      simulationId: sim.id,
      state: passed ? "SIMULATION_PASSED" : "SIMULATION_FAILED",
    },
  });
  await db.changePlanStateTransition.create({
    data: {
      changePlanId: plan.id,
      fromState: "SIMULATING",
      toState: plan.state,
    },
  });
  if (passed) {
    plan = await transition(db, plan.id, organizationId, "APPROVAL_PENDING");
  }
  return c.json(plan);
});

changePlanRoutes.post("/:id/approve", requireProductionTier(), async (c) => {
  const body = z
    .object({ justification: z.string().optional(), override: z.boolean().optional() })
    .parse((await c.req.json().catch(() => ({}))) ?? {});
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const plan = await db.changePlan.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);
  const check = canApprove({
    state: plan.state,
    override: body.override ? { allowed: true, justification: body.justification } : undefined,
  });
  if (!check.ok) return c.json({ error: "CONFLICT", message: check.reason }, 409);
  if (plan.state === "SIMULATION_FAILED") {
    await db.changePlanStateTransition.create({
      data: { changePlanId: plan.id, fromState: plan.state, toState: "APPROVAL_PENDING" },
    });
    await db.changePlan.update({ where: { id: plan.id }, data: { state: "APPROVAL_PENDING" } });
  }
  await db.changePlanApproval.create({
    data: {
      changePlanId: plan.id,
      userId: c.get("userId")!,
      decision: "approved",
      justification: body.justification,
    },
  });
  const updated = await transition(db, plan.id, organizationId, "APPROVED");
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "change_plan.approve",
    resourceType: "change_plan",
    resourceId: plan.id,
    environmentId: plan.environmentId,
    newValue: { override: body.override, justification: body.justification },
  });
  queue.publish("CHANGE_APPROVED", { organizationId, changePlanId: plan.id });
  return c.json(updated);
});

changePlanRoutes.post("/:id/reject", async (c) => {
  const updated = await transition(c.get("db"), c.req.param("id"), c.get("organizationId")!, "REJECTED");
  if (!updated) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(updated);
});

changePlanRoutes.post("/:id/rollout", requireProductionTier(), async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const plan = await db.changePlan.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);
  if (plan.state === "APPROVED") await transition(db, plan.id, organizationId, "ROLLING_OUT");
  const next =
    ROLLOUT_STAGES.find((s) => s > plan.rolloutPercent) ?? 100;
  await db.rollout.create({
    data: { organizationId, changePlanId: plan.id, percent: next, status: "active" },
  });
  const updated = await db.changePlan.update({
    where: { id: plan.id },
    data: { rolloutPercent: next, state: next === 100 ? "MONITORING" : "ROLLING_OUT" },
  });
  if (next === 100 && updated.proposedVersionId) {
    await db.runtimeVersion.update({
      where: { id: updated.proposedVersionId },
      data: { approved: true },
    });
    await db.changePlan.update({ where: { id: plan.id }, data: { state: "COMPLETED" } });
  }
  queue.publish("ROLLOUT_STARTED", { organizationId, changePlanId: plan.id, percent: next });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "rollout.start",
    resourceType: "change_plan",
    resourceId: plan.id,
    newValue: { percent: next },
  });
  return c.json({ ...updated, rolloutPercent: next });
});

changePlanRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      objective: z.string().optional(),
      gitCommit: z.string().optional(),
      gitBranch: z.string().optional(),
      gitPullRequest: z.string().optional(),
    })
    .parse(await c.req.json());

  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);

  if (["APPROVED", "ROLLING_OUT", "MONITORING", "COMPLETED"].includes(plan.state)) {
    return c.json({ error: "CONFLICT", message: "Cannot edit change plan once approved or in rollout" }, 409);
  }

  const updated = await db.changePlan.update({
    where: { id },
    data: body,
  });

  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "change_plan.update",
    resourceType: "change_plan",
    resourceId: id,
    environmentId: plan.environmentId,
    oldValue: plan,
    newValue: updated,
  });

  return c.json(updated);
});

changePlanRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);

  if (["ROLLING_OUT", "MONITORING"].includes(plan.state)) {
    return c.json({ error: "CONFLICT", message: "Cannot delete change plan during active rollout" }, 409);
  }

  // Delete dependencies first
  await db.changePlanApproval.deleteMany({ where: { changePlanId: id } });
  await db.changePlanStateTransition.deleteMany({ where: { changePlanId: id } });
  await db.rollout.deleteMany({ where: { changePlanId: id } });
  await db.rollback.deleteMany({ where: { changePlanId: id } });
  await db.changePlan.delete({ where: { id } });

  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "change_plan.delete",
    resourceType: "change_plan",
    resourceId: id,
    environmentId: plan.environmentId,
  });

  return c.json({ ok: true });
});

changePlanRoutes.post("/:id/guardrail-check", async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));
  const body = z
    .object({
      errorRate: z.number().optional(),
      p95Ms: z.number().optional(),
      availability: z.number().optional(),
    })
    .parse(rawBody);

  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const plan = await db.changePlan.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);

  let errorRate = body.errorRate;
  let p95Ms = body.p95Ms;
  let availability = body.availability;

  // Auto-query real metrics if not explicitly passed
  if (errorRate === undefined || p95Ms === undefined) {
    const { queryMetrics } = await import("../lib/clickhouse");
    const metrics = await queryMetrics(db, { organizationId, environmentId: plan.environmentId, minutesBack: 5 });
    errorRate = metrics.errorRate;
    p95Ms = metrics.p95Ms;
    availability = 1 - errorRate;
  }

  let action: "continue" | "pause" | "stop" | "rollback" = "continue";
  if (errorRate > 0.05) action = "stop";
  else if (p95Ms > 2000) action = "pause";
  else if ((availability ?? 1) < 0.99) action = "rollback";

  if (action === "pause") {
    await transition(db, plan.id, organizationId, "ROLLOUT_PAUSED");
    queue.publish("ROLLOUT_PAUSED", { changePlanId: plan.id, metrics: { errorRate, p95Ms } });
  }
  if (action === "rollback" || action === "stop") {
    return rollbackPlan(c, plan.id);
  }
  return c.json({ action, metrics: { errorRate, p95Ms, availability } });
});

changePlanRoutes.post("/:id/rollback", requireProductionTier(), async (c) => rollbackPlan(c, c.req.param("id")));

async function rollbackPlan(c: Context<AppEnv>, id: string) {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const plan = await db.changePlan.findFirst({ where: { id, organizationId } });
  if (!plan) return c.json({ error: "NOT_FOUND" }, 404);
  if (plan.state !== "ROLLBACK_PENDING" && plan.state !== "ROLLED_BACK") {
    try {
      await transition(db, plan.id, organizationId, "ROLLBACK_PENDING");
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
    actorId: c.get("userId"),
    action: "rollback.execute",
    resourceType: "change_plan",
    resourceId: plan.id,
  });
  return c.json(updated);
}
