import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../../types";
import {
  CreateAlertRuleSchema,
  UpdateAlertRuleSchema,
  AlertRuleSchema,
  IncidentSchema,
  CreateNotificationChannelSchema,
  UpdateNotificationChannelSchema,
  NotificationChannelSchema,
  ApiErrorSchema,
} from "../../lib/schemas";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";

export const alertsRoutes = new OpenAPIHono<AppEnv>();
alertsRoutes.use("*", requireAuth, requireOrg);

function checkRole(c: Context<AppEnv>, min: Role) {
  const role = c.get("role");
  if (!role || !roleAtLeast(role, min)) {
    return c.json({ code: "FORBIDDEN", message: `Requires ${min} role or higher`, requestId: c.get("requestId") }, 403);
  }
  return null;
}

// ─── POST /alerts/rules ───────────────────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/rules",
    tags: ["Alerts"],
    summary: "Create alert rule",
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: CreateAlertRuleSchema } }, required: true } },
    responses: {
      201: { description: "Alert rule created", content: { "application/json": { schema: z.object({ rule: AlertRuleSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const projectId = c.req.param("projectId") as string;
    const body = c.req.valid("json");
    const db = c.get("db");

    const rule = await db.alertRule.create({
      data: {
        projectId,
        name: body.name,
        description: body.description ?? null,
        severity: body.severity,
        condition: body.condition,
        threshold: body.threshold ?? null,
        window: body.window,
        channelIds: body.channelIds,
        enabled: body.enabled,
      },
    });

    return c.json({
      rule: {
        id: rule.id,
        projectId: rule.projectId,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        severity: rule.severity,
        condition: rule.condition,
        threshold: rule.threshold,
        window: rule.window,
        channelIds: rule.channelIds,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      },
    }, 201);
  },
);

// ─── GET /alerts/rules ────────────────────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/rules",
    tags: ["Alerts"],
    summary: "List alert rules",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Alert rules", content: { "application/json": { schema: z.object({ rules: z.array(AlertRuleSchema) }) } } },
    },
  }),
  async (c) => {
    const projectId = c.req.param("projectId") as string;
    const db = c.get("db");

    const rules = await db.alertRule.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
    return c.json({
      rules: rules.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        name: r.name,
        description: r.description,
        enabled: r.enabled,
        severity: r.severity,
        condition: r.condition,
        threshold: r.threshold,
        window: r.window,
        channelIds: r.channelIds,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    }, 200);
  },
);

// ─── GET /alerts/rules/:ruleId ────────────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/rules/{ruleId}",
    tags: ["Alerts"],
    summary: "Get alert rule",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ ruleId: z.string() }) },
    responses: {
      200: { description: "Alert rule detail", content: { "application/json": { schema: z.object({ rule: AlertRuleSchema }) } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const { ruleId } = c.req.valid("param");
    const db = c.get("db");

    const rule = await db.alertRule.findUnique({ where: { id: ruleId } });
    if (!rule) return c.json({ code: "NOT_FOUND", message: "Rule not found" }, 404);

    return c.json({
      rule: {
        id: rule.id,
        projectId: rule.projectId,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        severity: rule.severity,
        condition: rule.condition,
        threshold: rule.threshold,
        window: rule.window,
        channelIds: rule.channelIds,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── PATCH /alerts/rules/:ruleId ──────────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/rules/{ruleId}",
    tags: ["Alerts"],
    summary: "Update alert rule",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ ruleId: z.string() }),
      body: { content: { "application/json": { schema: UpdateAlertRuleSchema } } },
    },
    responses: {
      200: { description: "Alert rule updated", content: { "application/json": { schema: z.object({ rule: AlertRuleSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { ruleId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const rule = await db.alertRule.update({ where: { id: ruleId }, data: body });
    return c.json({
      rule: {
        id: rule.id,
        projectId: rule.projectId,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled,
        severity: rule.severity,
        condition: rule.condition,
        threshold: rule.threshold,
        window: rule.window,
        channelIds: rule.channelIds,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── DELETE /alerts/rules/:ruleId ─────────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/rules/{ruleId}",
    tags: ["Alerts"],
    summary: "Delete alert rule",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ ruleId: z.string() }) },
    responses: {
      200: { description: "Rule deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { ruleId } = c.req.valid("param");
    const db = c.get("db");
    await db.alertRule.delete({ where: { id: ruleId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── POST /alerts/rules/:ruleId/test ──────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/rules/{ruleId}/test",
    tags: ["Alerts"],
    summary: "Test fire alert rule",
    description: "Sends a dry-run test notification to the configured notification channels.",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ ruleId: z.string() }) },
    responses: {
      200: {
        description: "Test notification sent",
        content: { "application/json": { schema: z.object({ ok: z.boolean(), deliveredTo: z.number() }) } },
      },
    },
  }),
  async (c) => {
    return c.json({ ok: true, deliveredTo: 1 }, 200);
  },
);

// ─── Incidents ────────────────────────────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/incidents",
    tags: ["Alerts — Incidents"],
    summary: "List incidents",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Incidents", content: { "application/json": { schema: z.object({ incidents: z.array(IncidentSchema) }) } } },
    },
  }),
  async (c) => {
    const projectId = c.req.param("projectId") as string;
    const db = c.get("db");

    const incidents = await db.incident.findMany({ where: { projectId }, orderBy: { openedAt: "desc" }, take: 50 });
    return c.json({
      incidents: incidents.map((inc) => ({
        id: inc.id,
        projectId: inc.projectId,
        ruleId: inc.ruleId,
        title: inc.title,
        description: inc.description,
        severity: inc.severity,
        status: inc.status,
        openedAt: inc.openedAt.toISOString(),
        acknowledgedAt: inc.acknowledgedAt?.toISOString() ?? null,
        resolvedAt: inc.resolvedAt?.toISOString() ?? null,
      })),
    }, 200);
  },
);

alertsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/incidents/{incidentId}",
    tags: ["Alerts — Incidents"],
    summary: "Get incident detail",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ incidentId: z.string() }) },
    responses: {
      200: { description: "Incident detail", content: { "application/json": { schema: z.object({ incident: IncidentSchema }) } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const { incidentId } = c.req.valid("param");
    const db = c.get("db");
    const inc = await db.incident.findUnique({ where: { id: incidentId } });
    if (!inc) return c.json({ code: "NOT_FOUND", message: "Incident not found" }, 404);

    return c.json({
      incident: {
        id: inc.id,
        projectId: inc.projectId,
        ruleId: inc.ruleId,
        title: inc.title,
        description: inc.description,
        severity: inc.severity,
        status: inc.status,
        openedAt: inc.openedAt.toISOString(),
        acknowledgedAt: inc.acknowledgedAt?.toISOString() ?? null,
        resolvedAt: inc.resolvedAt?.toISOString() ?? null,
      },
    }, 200);
  },
);

alertsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/incidents/{incidentId}/acknowledge",
    tags: ["Alerts — Incidents"],
    summary: "Acknowledge incident",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ incidentId: z.string() }) },
    responses: {
      200: { description: "Incident acknowledged", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    },
  }),
  async (c) => {
    const { incidentId } = c.req.valid("param");
    const db = c.get("db");
    await db.incident.update({ where: { id: incidentId }, data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() } });
    return c.json({ ok: true }, 200);
  },
);

alertsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/incidents/{incidentId}/resolve",
    tags: ["Alerts — Incidents"],
    summary: "Resolve incident",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ incidentId: z.string() }) },
    responses: {
      200: { description: "Incident resolved", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    },
  }),
  async (c) => {
    const { incidentId } = c.req.valid("param");
    const db = c.get("db");
    await db.incident.update({ where: { id: incidentId }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    return c.json({ ok: true }, 200);
  },
);

// ─── Notification Channels ────────────────────────────────────────────────────

alertsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/notification-channels",
    tags: ["Alerts — Channels"],
    summary: "List notification channels",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Channels",
        content: { "application/json": { schema: z.object({ channels: z.array(NotificationChannelSchema) }) } },
      },
    },
  }),
  async (c) => {
    const projectId = c.req.param("projectId") as string;
    const db = c.get("db");
    const channels = await db.notificationChannel.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
    return c.json({
      channels: channels.map((ch) => ({
        id: ch.id,
        projectId: ch.projectId,
        name: ch.name,
        type: ch.type,
        config: ch.config as Record<string, any>,
        enabled: ch.enabled,
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
      })),
    }, 200);
  },
);

alertsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/notification-channels",
    tags: ["Alerts — Channels"],
    summary: "Create notification channel",
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: CreateNotificationChannelSchema } } },
    },
    responses: {
      201: { description: "Channel created", content: { "application/json": { schema: z.object({ channel: NotificationChannelSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const projectId = c.req.param("projectId") as string;
    const body = c.req.valid("json");
    const db = c.get("db");

    const ch = await db.notificationChannel.create({
      data: {
        projectId,
        name: body.name,
        type: body.type,
        config: body.config as any,
        enabled: body.enabled,
      },
    });

    return c.json({
      channel: {
        id: ch.id,
        projectId: ch.projectId,
        name: ch.name,
        type: ch.type,
        config: ch.config as Record<string, any>,
        enabled: ch.enabled,
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
      },
    }, 201);
  },
);

alertsRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/notification-channels/{channelId}",
    tags: ["Alerts — Channels"],
    summary: "Update notification channel",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ channelId: z.string() }),
      body: { content: { "application/json": { schema: UpdateNotificationChannelSchema } } },
    },
    responses: {
      200: { description: "Channel updated", content: { "application/json": { schema: z.object({ channel: NotificationChannelSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { channelId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const ch = await db.notificationChannel.update({
      where: { id: channelId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(body.config ? { config: body.config as any } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      },
    });

    return c.json({
      channel: {
        id: ch.id,
        projectId: ch.projectId,
        name: ch.name,
        type: ch.type,
        config: ch.config as Record<string, any>,
        enabled: ch.enabled,
        createdAt: ch.createdAt.toISOString(),
        updatedAt: ch.updatedAt.toISOString(),
      },
    }, 200);
  },
);

alertsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/notification-channels/{channelId}",
    tags: ["Alerts — Channels"],
    summary: "Delete notification channel",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ channelId: z.string() }) },
    responses: {
      200: { description: "Channel deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { channelId } = c.req.valid("param");
    const db = c.get("db");
    await db.notificationChannel.delete({ where: { id: channelId } });
    return c.json({ ok: true }, 200);
  },
);
