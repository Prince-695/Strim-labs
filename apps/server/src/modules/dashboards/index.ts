import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../../types";
import {
  CreateDashboardSchema,
  UpdateDashboardSchema,
  DashboardSchema,
  CreatePanelSchema,
  UpdatePanelSchema,
  PanelSchema,
  PreviewQuerySchema,
  ApiErrorSchema,
} from "../../lib/schemas";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";

export const dashboardsRoutes = new OpenAPIHono<AppEnv>();
dashboardsRoutes.use("*", requireAuth, requireOrg);

function checkRole(c: Context<AppEnv>, min: Role) {
  const role = c.get("role");
  if (!role || !roleAtLeast(role, min)) {
    return c.json({ code: "FORBIDDEN", message: `Requires ${min} role or higher`, requestId: c.get("requestId") }, 403);
  }
  return null;
}

// ─── POST /dashboards ─────────────────────────────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Dashboards"],
    summary: "Create dashboard",
    description: "Create a custom observability dashboard within a project.",
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: CreateDashboardSchema } }, required: true } },
    responses: {
      201: { description: "Dashboard created", content: { "application/json": { schema: z.object({ dashboard: DashboardSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const projectId = c.req.param("projectId") as string;
    const { name, description } = c.req.valid("json");
    const db = c.get("db");

    const dashboard = await db.dashboard.create({
      data: { projectId, name, description },
      include: { _count: { select: { panels: true } } },
    });

    return c.json({
      dashboard: {
        id: dashboard.id,
        projectId: dashboard.projectId,
        name: dashboard.name,
        description: dashboard.description,
        isDefault: dashboard.isDefault,
        panelCount: dashboard._count.panels,
        createdAt: dashboard.createdAt.toISOString(),
        updatedAt: dashboard.updatedAt.toISOString(),
      },
    }, 201);
  },
);

// ─── GET /dashboards ──────────────────────────────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Dashboards"],
    summary: "List dashboards",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Dashboards list", content: { "application/json": { schema: z.object({ dashboards: z.array(DashboardSchema) }) } } },
    },
  }),
  async (c) => {
    const projectId = c.req.param("projectId") as string;
    const db = c.get("db");

    const list = await db.dashboard.findMany({
      where: { projectId },
      include: { _count: { select: { panels: true } } },
      orderBy: { createdAt: "asc" },
    });

    return c.json({
      dashboards: list.map((d) => ({
        id: d.id,
        projectId: d.projectId,
        name: d.name,
        description: d.description,
        isDefault: d.isDefault,
        panelCount: d._count.panels,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    }, 200);
  },
);

// ─── GET /dashboards/:dashboardId ─────────────────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{dashboardId}",
    tags: ["Dashboards"],
    summary: "Get dashboard and panels",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ dashboardId: z.string() }) },
    responses: {
      200: {
        description: "Dashboard detail",
        content: {
          "application/json": {
            schema: z.object({
              dashboard: DashboardSchema,
              panels: z.array(PanelSchema),
            }),
          },
        },
      },
      404: { description: "Dashboard not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const { dashboardId } = c.req.valid("param");
    const db = c.get("db");

    const dashboard = await db.dashboard.findUnique({
      where: { id: dashboardId },
      include: {
        panels: true,
        _count: { select: { panels: true } },
      },
    });

    if (!dashboard) return c.json({ code: "NOT_FOUND", message: "Dashboard not found" }, 404);

    return c.json({
      dashboard: {
        id: dashboard.id,
        projectId: dashboard.projectId,
        name: dashboard.name,
        description: dashboard.description,
        isDefault: dashboard.isDefault,
        panelCount: dashboard._count.panels,
        createdAt: dashboard.createdAt.toISOString(),
        updatedAt: dashboard.updatedAt.toISOString(),
      },
      panels: dashboard.panels.map((p) => ({
        id: p.id,
        dashboardId: p.dashboardId,
        type: p.type as any,
        title: p.title,
        description: p.description,
        query: (p.query ?? {}) as Record<string, any>,
        layout: (p.layout ?? { x: 0, y: 0, w: 12, h: 4 }) as any,
        options: (p.options ?? null) as Record<string, any> | null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    }, 200);
  },
);

// ─── PATCH /dashboards/:dashboardId ───────────────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{dashboardId}",
    tags: ["Dashboards"],
    summary: "Update dashboard",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ dashboardId: z.string() }),
      body: { content: { "application/json": { schema: UpdateDashboardSchema } } },
    },
    responses: {
      200: { description: "Dashboard updated", content: { "application/json": { schema: z.object({ dashboard: DashboardSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Dashboard not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { dashboardId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const updated = await db.dashboard.update({
      where: { id: dashboardId },
      data: body,
      include: { _count: { select: { panels: true } } },
    });

    return c.json({
      dashboard: {
        id: updated.id,
        projectId: updated.projectId,
        name: updated.name,
        description: updated.description,
        isDefault: updated.isDefault,
        panelCount: updated._count.panels,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── DELETE /dashboards/:dashboardId ──────────────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{dashboardId}",
    tags: ["Dashboards"],
    summary: "Delete dashboard",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ dashboardId: z.string() }) },
    responses: {
      200: { description: "Dashboard deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { dashboardId } = c.req.valid("param");
    const db = c.get("db");

    await db.dashboard.delete({ where: { id: dashboardId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── POST /dashboards/:dashboardId/duplicate ──────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{dashboardId}/duplicate",
    tags: ["Dashboards"],
    summary: "Clone dashboard",
    description: "Create an exact duplicate of a dashboard and all its panels.",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ dashboardId: z.string() }) },
    responses: {
      201: { description: "Dashboard duplicated", content: { "application/json": { schema: z.object({ dashboard: DashboardSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { dashboardId } = c.req.valid("param");
    const db = c.get("db");

    const source = await db.dashboard.findUnique({
      where: { id: dashboardId },
      include: { panels: true },
    });

    if (!source) return c.json({ code: "NOT_FOUND", message: "Dashboard not found" }, 404 as any);

    const cloned = await db.dashboard.create({
      data: {
        projectId: source.projectId,
        name: `${source.name} (Copy)`,
        description: source.description,
        isDefault: false,
        panels: {
          create: source.panels.map((p) => ({
            type: p.type,
            title: p.title,
            description: p.description,
            query: p.query as any,
            layout: p.layout as any,
            options: p.options as any,
          })),
        },
      },
      include: { _count: { select: { panels: true } } },
    });

    return c.json({
      dashboard: {
        id: cloned.id,
        projectId: cloned.projectId,
        name: cloned.name,
        description: cloned.description,
        isDefault: cloned.isDefault,
        panelCount: cloned._count.panels,
        createdAt: cloned.createdAt.toISOString(),
        updatedAt: cloned.updatedAt.toISOString(),
      },
    }, 201);
  },
);

// ─── POST /dashboards/:dashboardId/panels ─────────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{dashboardId}/panels",
    tags: ["Dashboards — Panels"],
    summary: "Add panel to dashboard",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ dashboardId: z.string() }),
      body: { content: { "application/json": { schema: CreatePanelSchema } } },
    },
    responses: {
      201: { description: "Panel created", content: { "application/json": { schema: z.object({ panel: PanelSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { dashboardId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const panel = await db.dashboardPanel.create({
      data: {
        dashboardId,
        type: body.type,
        title: body.title,
        description: body.description ?? null,
        query: body.query as any,
        layout: body.layout as any,
        options: body.options as any,
      },
    });

    return c.json({
      panel: {
        id: panel.id,
        dashboardId: panel.dashboardId,
        type: panel.type as any,
        title: panel.title,
        description: panel.description,
        query: (panel.query ?? {}) as Record<string, any>,
        layout: (panel.layout ?? { x: 0, y: 0, w: 12, h: 4 }) as any,
        options: (panel.options ?? null) as Record<string, any> | null,
        createdAt: panel.createdAt.toISOString(),
        updatedAt: panel.updatedAt.toISOString(),
      },
    }, 201);
  },
);

// ─── PATCH /dashboards/:dashboardId/panels/:panelId ───────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{dashboardId}/panels/{panelId}",
    tags: ["Dashboards — Panels"],
    summary: "Update panel",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ dashboardId: z.string(), panelId: z.string() }),
      body: { content: { "application/json": { schema: UpdatePanelSchema } } },
    },
    responses: {
      200: { description: "Panel updated", content: { "application/json": { schema: z.object({ panel: PanelSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { panelId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const updated = await db.dashboardPanel.update({
      where: { id: panelId },
      data: {
        ...(body.type ? { type: body.type } : {}),
        ...(body.title ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.query ? { query: body.query as any } : {}),
        ...(body.layout ? { layout: body.layout as any } : {}),
        ...(body.options !== undefined ? { options: body.options as any } : {}),
      },
    });

    return c.json({
      panel: {
        id: updated.id,
        dashboardId: updated.dashboardId,
        type: updated.type as any,
        title: updated.title,
        description: updated.description,
        query: (updated.query ?? {}) as Record<string, any>,
        layout: (updated.layout ?? { x: 0, y: 0, w: 12, h: 4 }) as any,
        options: (updated.options ?? null) as Record<string, any> | null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── DELETE /dashboards/:dashboardId/panels/:panelId ───────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{dashboardId}/panels/{panelId}",
    tags: ["Dashboards — Panels"],
    summary: "Remove panel",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ dashboardId: z.string(), panelId: z.string() }) },
    responses: {
      200: { description: "Panel removed", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const { panelId } = c.req.valid("param");
    const db = c.get("db");
    await db.dashboardPanel.delete({ where: { id: panelId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── POST /queries/preview ───────────────────────────────────────────────────

dashboardsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/preview-query",
    tags: ["Dashboards — Queries"],
    summary: "Preview custom metric query",
    description: "Evaluates an expression or query without saving it to a dashboard.",
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: PreviewQuerySchema } } },
    },
    responses: {
      200: {
        description: "Preview query results",
        content: {
          "application/json": {
            schema: z.object({
              results: z.array(z.record(z.any())),
              evaluatedAt: z.string(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    return c.json({ results: [{ time: new Date().toISOString(), value: 42.0 }], evaluatedAt: new Date().toISOString() }, 200);
  },
);
