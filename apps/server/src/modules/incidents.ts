import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { writeAudit } from "../lib/audit";
import { queue } from "../lib/queue";

export const incidentRoutes = new Hono<AppEnv>();
incidentRoutes.use("*", requireAuth, requireOrg);

incidentRoutes.post("/evaluate", async (c) => {
  const body = z
    .object({
      environmentId: z.string(),
      errorRate: z.number(),
      p95Ms: z.number(),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const baseline = await db.anomalyBaseline.findFirst({
    where: { environmentId: body.environmentId, metric: "errorRate" },
  });
  const mean = baseline?.mean ?? 0.01;
  const stddev = baseline?.stddev ?? 0.005;
  const threshold = mean + 3 * stddev;
  if (body.errorRate <= threshold) {
    return c.json({ triggered: false, threshold });
  }
  const recentChange = await db.changePlan.findFirst({
    where: { environmentId: body.environmentId, organizationId },
    orderBy: { createdAt: "desc" },
  });
  const incident = await db.incident.create({
    data: {
      organizationId,
      environmentId: body.environmentId,
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
    actorId: c.get("userId"),
    action: "incident.create",
    resourceType: "incident",
    resourceId: incident.id,
    environmentId: body.environmentId,
  });
  await db.notification.create({
    data: {
      organizationId,
      title: "Incident opened",
      body: incident.title,
    },
  });
  return c.json({ triggered: true, incident });
});

incidentRoutes.get("/", async (c) => {
  const incidents = await c.get("db").incident.findMany({
    where: {
      organizationId: c.get("organizationId")!,
      environmentId: c.req.query("environmentId") || undefined,
    },
    include: { factors: true, timeline: true },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ incidents });
});

incidentRoutes.post("/:id/resolve", async (c) => {
  const incident = await c.get("db").incident.update({
    where: { id: c.req.param("id") },
    data: { status: "resolved", resolvedAt: new Date() },
  });
  queue.publish("INCIDENT_RESOLVED", { incidentId: incident.id });
  return c.json(incident);
});

incidentRoutes.get("/notifications", async (c) => {
  const notes = await c.get("db").notification.findMany({
    where: { organizationId: c.get("organizationId")! },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return c.json({ notifications: notes });
});
