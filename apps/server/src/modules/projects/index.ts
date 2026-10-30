import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../../types";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectSchema,
  ApiErrorSchema,
} from "../../lib/schemas";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { randomToken } from "../../lib/crypto";

export const projectsRoutes = new OpenAPIHono<AppEnv>();
projectsRoutes.use("*", requireAuth, requireOrg);

function checkRole(c: Context<AppEnv>, min: Role) {
  const role = c.get("role");
  if (!role || !roleAtLeast(role, min)) {
    return c.json({ code: "FORBIDDEN", message: `Requires ${min} role or higher`, requestId: c.get("requestId") }, 403);
  }
  return null;
}

// ─── POST /organizations/:orgId/projects ──────────────────────────────────────

projectsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Projects"],
    summary: "Create project",
    description: "Create a project within the organization. **Maximum 5 projects per organization.**",
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: CreateProjectSchema } }, required: true } },
    responses: {
      201: { description: "Project created", content: { "application/json": { schema: z.object({ project: ProjectSchema, ingestKey: z.string() }) } } },
      400: { description: "Project limit reached (max 5)", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const orgId = c.get("organizationId")!;
    const { name, description } = c.req.valid("json");
    const db = c.get("db");
    const reqId = c.get("requestId");

    const count = await db.project.count({ where: { organizationId: orgId } });
    if (count >= 5) {
      return c.json({ code: "PROJECT_LIMIT_EXCEEDED", message: "Maximum of 5 projects per organization", requestId: reqId }, 400);
    }

    const ingestKey = `strim_live_${randomToken(20)}`;
    const project = await db.project.create({
      data: { organizationId: orgId, name, description, ingestKey },
      include: { _count: { select: { services: true } } },
    });

    await db.auditLog.create({
      data: { organizationId: orgId, userId: c.get("userId"), action: "CREATE", resourceType: "Project", resourceId: project.id },
    });

    return c.json({
      project: {
        id: project.id,
        organizationId: orgId,
        name: project.name,
        description: project.description,
        status: project.status,
        ingestKey: project.ingestKey,
        serviceCount: 0,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
      ingestKey,
    }, 201);
  },
);

// ─── GET /organizations/:orgId/projects ───────────────────────────────────────

projectsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Projects"],
    summary: "List projects",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Projects list",
        content: {
          "application/json": {
            schema: z.object({ projects: z.array(ProjectSchema), maxProjects: z.literal(5) }),
          },
        },
      },
    },
  }),
  async (c) => {
    const orgId = c.get("organizationId")!;
    const db = c.get("db");

    const projects = await db.project.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { services: true } } },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      projects: projects.map((p) => ({
        id: p.id,
        organizationId: orgId,
        name: p.name,
        description: p.description,
        status: p.status,
        ingestKey: p.ingestKey,
        serviceCount: p._count.services,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      maxProjects: 5 as const,
    }, 200);
  },
);

// ─── GET /organizations/:orgId/projects/:projectId ────────────────────────────

projectsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{projectId}",
    tags: ["Projects"],
    summary: "Get project",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ projectId: z.string() }) },
    responses: {
      200: { description: "Project detail", content: { "application/json": { schema: z.object({ project: ProjectSchema }) } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const orgId = c.get("organizationId")!;
    const { projectId } = c.req.valid("param");
    const db = c.get("db");

    const project = await db.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      include: { _count: { select: { services: true } } },
    });

    if (!project) return c.json({ code: "NOT_FOUND", message: "Project not found" }, 404);

    return c.json({
      project: {
        id: project.id,
        organizationId: orgId,
        name: project.name,
        description: project.description,
        status: project.status,
        ingestKey: project.ingestKey,
        serviceCount: project._count.services,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── PATCH /organizations/:orgId/projects/:projectId ─────────────────────────

projectsRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{projectId}",
    tags: ["Projects"],
    summary: "Update project",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ projectId: z.string() }),
      body: { content: { "application/json": { schema: UpdateProjectSchema } } },
    },
    responses: {
      200: { description: "Project updated", content: { "application/json": { schema: z.object({ project: ProjectSchema }) } } },
      403: { description: "Requires DEVELOPER role", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "DEVELOPER");
    if (roleErr) return roleErr;

    const orgId = c.get("organizationId")!;
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");

    const existing = await db.project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (!existing) return c.json({ code: "NOT_FOUND", message: "Project not found" }, 404);

    const project = await db.project.update({
      where: { id: projectId },
      data: body,
      include: { _count: { select: { services: true } } },
    });

    return c.json({
      project: {
        id: project.id,
        organizationId: orgId,
        name: project.name,
        description: project.description,
        status: project.status,
        ingestKey: project.ingestKey,
        serviceCount: project._count.services,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── DELETE /organizations/:orgId/projects/:projectId ────────────────────────

projectsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{projectId}",
    tags: ["Projects"],
    summary: "Delete project",
    description: "Permanently deletes the project and all associated data.",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ projectId: z.string() }) },
    responses: {
      200: { description: "Project deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires ENGINEER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ENGINEER");
    if (roleErr) return roleErr;

    const orgId = c.get("organizationId")!;
    const { projectId } = c.req.valid("param");
    const db = c.get("db");

    await db.project.deleteMany({ where: { id: projectId, organizationId: orgId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── POST /organizations/:orgId/projects/:projectId/rotate-key ───────────────

projectsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{projectId}/rotate-key",
    tags: ["Projects"],
    summary: "Rotate ingest key",
    description: "Generates a new ingest API key and revokes the previous one. Update your SDK configuration immediately.",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ projectId: z.string() }) },
    responses: {
      200: { description: "Key rotated", content: { "application/json": { schema: z.object({ ingestKey: z.string() }) } } },
      403: { description: "Requires ENGINEER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ENGINEER");
    if (roleErr) return roleErr;

    const orgId = c.get("organizationId")!;
    const { projectId } = c.req.valid("param");
    const db = c.get("db");

    const newKey = `strim_live_${randomToken(20)}`;
    await db.project.update({ where: { id: projectId }, data: { ingestKey: newKey } });

    await db.auditLog.create({
      data: { organizationId: orgId, userId: c.get("userId"), action: "ROTATE_KEY", resourceType: "Project", resourceId: projectId },
    });

    return c.json({ ingestKey: newKey }, 200);
  },
);

// ─── GET /organizations/:orgId/projects/:projectId/usage ─────────────────────

projectsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{projectId}/usage",
    tags: ["Projects"],
    summary: "Get project usage",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ projectId: z.string() }) },
    responses: {
      200: {
        description: "Project usage stats",
        content: {
          "application/json": {
            schema: z.object({
              requestsThisMonth: z.number(),
              loadTestMinutesThisMonth: z.number(),
              servicesCount: z.number(),
              storageBytes: z.number(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { projectId } = c.req.valid("param");
    const db = c.get("db");

    const [serviceCount, testRunCount] = await Promise.all([
      db.service.count({ where: { projectId } }),
      db.testRun.count({ where: { projectId } }),
    ]);

    return c.json({
      requestsThisMonth: 0,
      loadTestMinutesThisMonth: 0,
      servicesCount: serviceCount,
      storageBytes: 0,
    }, 200);
  },
);

// ─── GET /organizations/:orgId/projects/:projectId/activity ──────────────────

projectsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{projectId}/activity",
    tags: ["Projects"],
    summary: "Get project activity log",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ projectId: z.string() }) },
    responses: {
      200: {
        description: "Recent project activity",
        content: {
          "application/json": {
            schema: z.object({ activity: z.array(z.object({ action: z.string(), at: z.string(), user: z.string().nullable() })) }),
          },
        },
      },
    },
  }),
  async (c) => {
    const orgId = c.get("organizationId")!;
    const { projectId } = c.req.valid("param");
    const db = c.get("db");

    const logs = await db.auditLog.findMany({
      where: { organizationId: orgId, resourceId: projectId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return c.json({
      activity: logs.map((l) => ({
        action: l.action,
        at: l.createdAt.toISOString(),
        user: l.user?.name ?? null,
      })),
    }, 200);
  },
);
