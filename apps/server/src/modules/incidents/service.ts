import type { PrismaClient } from "@strim/db";
import { writeAudit } from "../../lib/audit";
import { queue } from "../../lib/queue";
import * as ChangePlanService from "../change-plans/service";
import type { EvaluateIncidentInput } from "./types";

export async function evaluateIncident(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  input: EvaluateIncidentInput,
) {
  const baseline = await db.anomalyBaseline.findFirst({
    where: { environmentId: input.environmentId, metric: "errorRate" },
  });

  const mean = baseline?.mean ?? 0.01;
  const stddev = baseline?.stddev ?? 0.005;
  const threshold = mean + 3 * stddev;

  if (input.errorRate <= threshold) {
    return { triggered: false, threshold };
  }

  const recentChange = await db.changePlan.findFirst({
    where: { environmentId: input.environmentId, organizationId },
    orderBy: { createdAt: "desc" },
  });

  const incident = await db.incident.create({
    data: {
      organizationId,
      environmentId: input.environmentId,
      title: "Error rate anomaly",
      severity: "high",
      changePlanId: recentChange?.id,
      factors: {
        create: [
          {
            label: "Error rate exceeded baseline",
            confidence: "High",
            sourceId: "metrics",
            occurredAt: new Date(),
          },
          ...(recentChange
            ? [
                {
                  label: "Recent change plan is a potential contributing factor",
                  confidence: "Medium" as const,
                  sourceId: recentChange.id,
                  occurredAt: recentChange.createdAt,
                },
              ]
            : []),
        ],
      },
      timeline: {
        create: [
          ...(recentChange
            ? [{ label: "Change plan created", occurredAt: recentChange.createdAt }]
            : []),
          { label: "Metric degradation observed", occurredAt: new Date() },
          { label: "Incident opened", occurredAt: new Date() },
        ],
      },
    },
    include: { factors: true, timeline: true },
  });

  queue.publish("INCIDENT_CREATED", { organizationId, incidentId: incident.id });

  await writeAudit(db, {
    organizationId,
    actorId,
    action: "incident.create",
    resourceType: "incident",
    resourceId: incident.id,
    environmentId: input.environmentId,
  });

  await db.notification.create({
    data: {
      organizationId,
      title: "Incident opened",
      body: incident.title,
    },
  });

  return { triggered: true, threshold, incident };
}

export async function listIncidents(
  db: PrismaClient,
  organizationId: string,
  environmentId?: string,
) {
  return db.incident.findMany({
    where: {
      organizationId,
      ...(environmentId ? { environmentId } : {}),
    },
    include: { factors: true, timeline: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getIncident(db: PrismaClient, organizationId: string, id: string) {
  const incident = await db.incident.findFirst({
    where: { id, organizationId },
    include: { factors: true, timeline: true, changePlan: true },
  });

  if (!incident) throw new Error("INCIDENT_NOT_FOUND");
  return incident;
}

export async function resolveIncident(db: PrismaClient, organizationId: string, id: string) {
  const existing = await db.incident.findFirst({ where: { id, organizationId } });
  if (!existing) throw new Error("INCIDENT_NOT_FOUND");

  const resolved = await db.incident.update({
    where: { id },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  queue.publish("INCIDENT_RESOLVED", { organizationId, incidentId: id });
  return resolved;
}

export async function rollbackFromIncident(
  db: PrismaClient,
  organizationId: string,
  actorId: string | undefined,
  id: string,
) {
  const incident = await db.incident.findFirst({ where: { id, organizationId } });
  if (!incident) throw new Error("INCIDENT_NOT_FOUND");

  if (!incident.changePlanId) {
    throw new Error("NO_CORRELATED_CHANGE_PLAN: Incident is not linked to any change plan");
  }

  const rolledBackPlan = await ChangePlanService.rollbackChangePlan(
    db,
    organizationId,
    actorId,
    incident.changePlanId,
  );

  return {
    success: true,
    message: "Instant rollback executed for correlated change plan",
    restoredVersionId: rolledBackPlan.currentVersionId,
  };
}

export async function listNotifications(db: PrismaClient, organizationId: string) {
  return db.notification.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
