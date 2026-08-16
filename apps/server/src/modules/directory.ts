import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { writeAudit } from "../lib/audit";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { requireRole } from "../middleware/rbac";

export const directoryRoutes = new Hono<AppEnv>();

directoryRoutes.use("*", requireAuth, requireOrg);

directoryRoutes.get("/context", async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const workspaces = await db.workspace.findMany({
    where: { organizationId },
    include: { projects: { include: { applications: { include: { environments: true } } } } },
  });
  return c.json({ workspaces });
});

directoryRoutes.post("/workspaces", requireRole("ADMIN"), async (c) => {
  const body = z.object({ name: z.string(), slug: z.string() }).parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const ws = await db.workspace.create({ data: { ...body, organizationId } });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "workspace.create",
    resourceType: "workspace",
    resourceId: ws.id,
    newValue: body,
  });
  return c.json(ws, 201);
});

directoryRoutes.get("/teams", async (c) => {
  const teams = await c.get("db").team.findMany({
    where: { organizationId: c.get("organizationId")! },
    include: { members: true },
  });
  return c.json({ teams });
});

directoryRoutes.post("/teams", requireRole("ADMIN"), async (c) => {
  const body = z.object({ name: z.string() }).parse(await c.req.json());
  const team = await c.get("db").team.create({
    data: { name: body.name, organizationId: c.get("organizationId")! },
  });
  return c.json(team, 201);
});

directoryRoutes.post("/projects", requireRole("ENGINEER"), async (c) => {
  const body = z
    .object({ workspaceId: z.string(), name: z.string(), slug: z.string() })
    .parse(await c.req.json());
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const ws = await db.workspace.findFirst({ where: { id: body.workspaceId, organizationId } });
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);
  const project = await db.project.create({ data: { ...body, organizationId } });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "project.create",
    resourceType: "project",
    resourceId: project.id,
    newValue: body,
  });
  return c.json(project, 201);
});

directoryRoutes.post("/applications", requireRole("ENGINEER"), async (c) => {
  const body = z
    .object({
      projectId: z.string(),
      name: z.string(),
      repository: z.string().optional(),
      language: z.string().optional(),
      framework: z.string().optional(),
      region: z.string().optional(),
      version: z.string().optional(),
      ownerTeamId: z.string(),
      technicalOwnerId: z.string(),
      oncallTeamId: z.string(),
    })
    .parse(await c.req.json());
  if (!body.ownerTeamId || !body.technicalOwnerId || !body.oncallTeamId) {
    return c.json({ error: "VALIDATION", message: "Owner Team, Technical Owner, and On-call Team are required" }, 400);
  }
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const project = await db.project.findFirst({ where: { id: body.projectId, organizationId } });
  if (!project) return c.json({ error: "NOT_FOUND" }, 404);
  const app = await db.application.create({ data: { ...body, organizationId } });
  for (const [name, type] of [
    ["Development", "DEVELOPMENT"],
    ["Staging", "STAGING"],
    ["Production", "PRODUCTION"],
  ] as const) {
    await db.environment.create({
      data: { organizationId, applicationId: app.id, name, type },
    });
  }
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "application.create",
    resourceType: "application",
    resourceId: app.id,
    newValue: body,
  });
  return c.json(app, 201);
});

directoryRoutes.get("/applications", async (c) => {
  const apps = await c.get("db").application.findMany({
    where: { organizationId: c.get("organizationId")! },
    include: { environments: true, ownerTeam: true, oncallTeam: true },
  });
  return c.json({ applications: apps });
});

directoryRoutes.get("/applications/:id", async (c) => {
  const app = await c.get("db").application.findFirst({
    where: { id: c.req.param("id"), organizationId: c.get("organizationId")! },
    include: { environments: true },
  });
  if (!app) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(app);
});
