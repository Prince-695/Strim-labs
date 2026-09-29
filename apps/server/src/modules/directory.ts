import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { writeAudit } from "../lib/audit";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { requireRole } from "../middleware/rbac";
import { randomToken, sha256 } from "../lib/crypto";

export const directoryRoutes = new Hono<AppEnv>();

directoryRoutes.use("*", requireAuth, requireOrg);

// --- Organizations ---
directoryRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const org = await c.get("db").organization.findUnique({
    where: { id: organizationId },
    include: {
      billingAccount: true,
      _count: {
        select: {
          memberships: true,
          workspaces: true,
          projects: true,
          applications: true,
        },
      },
    },
  });
  if (!org) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(org);
});

directoryRoutes.patch("/", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z
    .object({
      name: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
    })
    .parse(await c.req.json());

  const updated = await c.get("db").organization.update({
    where: { id: organizationId },
    data: body,
  });

  await writeAudit(c.get("db"), {
    organizationId,
    actorId: c.get("userId"),
    action: "organization.update",
    resourceType: "organization",
    resourceId: organizationId,
    newValue: body,
  });

  return c.json(updated);
});

// --- Context Hierarchy ---
directoryRoutes.get("/context", async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const workspaces = await db.workspace.findMany({
    where: { organizationId },
    include: { projects: { include: { applications: { include: { environments: true } } } } },
  });
  return c.json({ workspaces });
});

// --- Workspaces CRUD ---
directoryRoutes.get("/workspaces", async (c) => {
  const organizationId = c.get("organizationId")!;
  const workspaces = await c.get("db").workspace.findMany({
    where: { organizationId },
    include: {
      _count: { select: { projects: true } },
    },
  });
  return c.json({ workspaces });
});

directoryRoutes.get("/workspaces/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const ws = await c.get("db").workspace.findFirst({
    where: { id: c.req.param("id"), organizationId },
    include: { projects: { include: { applications: true } } },
  });
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(ws);
});

directoryRoutes.post("/workspaces", requireRole("ADMIN"), async (c) => {
  const body = z.object({ name: z.string().min(1), slug: z.string().min(1) }).parse(await c.req.json());
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

directoryRoutes.patch("/workspaces/:id", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z
    .object({ name: z.string().min(1).optional(), slug: z.string().min(1).optional() })
    .parse(await c.req.json());

  const existing = await c.get("db").workspace.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const updated = await c.get("db").workspace.update({
    where: { id: existing.id },
    data: body,
  });
  return c.json(updated);
});

directoryRoutes.delete("/workspaces/:id", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const existing = await c.get("db").workspace.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").workspace.delete({ where: { id: existing.id } });
  return c.json({ success: true });
});

// --- Projects CRUD ---
directoryRoutes.get("/projects", async (c) => {
  const organizationId = c.get("organizationId")!;
  const workspaceId = c.req.query("workspaceId");
  const projects = await c.get("db").project.findMany({
    where: { organizationId, workspaceId: workspaceId || undefined },
    include: { _count: { select: { applications: true } }, workspace: true },
  });
  return c.json({ projects });
});

directoryRoutes.get("/projects/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const project = await c.get("db").project.findFirst({
    where: { id: c.req.param("id"), organizationId },
    include: { applications: { include: { environments: true } }, workspace: true },
  });
  if (!project) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(project);
});

directoryRoutes.post("/projects", requireRole("ENGINEER"), async (c) => {
  const body = z
    .object({ workspaceId: z.string(), name: z.string().min(1), slug: z.string().min(1) })
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

directoryRoutes.patch("/projects/:id", requireRole("ENGINEER"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z
    .object({ name: z.string().min(1).optional(), slug: z.string().min(1).optional() })
    .parse(await c.req.json());

  const existing = await c.get("db").project.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const updated = await c.get("db").project.update({
    where: { id: existing.id },
    data: body,
  });
  return c.json(updated);
});

directoryRoutes.delete("/projects/:id", requireRole("ENGINEER"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const existing = await c.get("db").project.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").project.delete({ where: { id: existing.id } });
  return c.json({ success: true });
});

// --- Applications CRUD ---
directoryRoutes.get("/applications", async (c) => {
  const apps = await c.get("db").application.findMany({
    where: { organizationId: c.get("organizationId")! },
    include: { environments: true, ownerTeam: true, oncallTeam: true, technicalOwner: true, project: true },
  });
  return c.json({ applications: apps });
});

directoryRoutes.get("/applications/:id", async (c) => {
  const app = await c.get("db").application.findFirst({
    where: { id: c.req.param("id"), organizationId: c.get("organizationId")! },
    include: { environments: true, ownerTeam: true, oncallTeam: true, technicalOwner: true, project: true },
  });
  if (!app) return c.json({ error: "NOT_FOUND" }, 404);
  return c.json(app);
});

directoryRoutes.post("/applications", requireRole("ENGINEER"), async (c) => {
  const body = z
    .object({
      projectId: z.string(),
      name: z.string().min(1),
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

directoryRoutes.patch("/applications/:id", requireRole("ENGINEER"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z
    .object({
      name: z.string().min(1).optional(),
      repository: z.string().optional(),
      language: z.string().optional(),
      framework: z.string().optional(),
      region: z.string().optional(),
      version: z.string().optional(),
      ownerTeamId: z.string().optional(),
      technicalOwnerId: z.string().optional(),
      oncallTeamId: z.string().optional(),
    })
    .parse(await c.req.json());

  const existing = await c.get("db").application.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const updated = await c.get("db").application.update({
    where: { id: existing.id },
    data: body,
  });
  return c.json(updated);
});

directoryRoutes.delete("/applications/:id", requireRole("ENGINEER"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const existing = await c.get("db").application.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").application.delete({ where: { id: existing.id } });
  return c.json({ success: true });
});

// --- Environments CRUD ---
directoryRoutes.get("/environments", async (c) => {
  const organizationId = c.get("organizationId")!;
  const applicationId = c.req.query("applicationId");
  const envs = await c.get("db").environment.findMany({
    where: { organizationId, applicationId: applicationId || undefined },
    include: { application: true },
  });
  return c.json({ environments: envs });
});

directoryRoutes.post("/environments", requireRole("ENGINEER"), async (c) => {
  const body = z
    .object({
      applicationId: z.string(),
      name: z.string().min(1),
      type: z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION", "CUSTOM"]).default("CUSTOM"),
    })
    .parse(await c.req.json());

  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const app = await db.application.findFirst({ where: { id: body.applicationId, organizationId } });
  if (!app) return c.json({ error: "NOT_FOUND" }, 404);

  const env = await db.environment.create({
    data: { organizationId, applicationId: body.applicationId, name: body.name, type: body.type },
  });
  return c.json(env, 201);
});

directoryRoutes.patch("/environments/:id", requireRole("ENGINEER"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z
    .object({
      name: z.string().min(1).optional(),
      type: z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION", "CUSTOM"]).optional(),
      declaredState: z.record(z.unknown()).optional(),
    })
    .parse(await c.req.json());

  const existing = await c.get("db").environment.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const updated = await c.get("db").environment.update({
    where: { id: existing.id },
    data: {
      ...body,
      declaredState: body.declaredState as object | undefined,
    },
  });
  return c.json(updated);
});

directoryRoutes.delete("/environments/:id", requireRole("ENGINEER"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const existing = await c.get("db").environment.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").environment.delete({ where: { id: existing.id } });
  return c.json({ success: true });
});

// --- Teams CRUD & Members ---
directoryRoutes.get("/teams", async (c) => {
  const teams = await c.get("db").team.findMany({
    where: { organizationId: c.get("organizationId")! },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  return c.json({ teams });
});

directoryRoutes.post("/teams", requireRole("ADMIN"), async (c) => {
  const body = z.object({ name: z.string().min(1) }).parse(await c.req.json());
  const team = await c.get("db").team.create({
    data: { name: body.name, organizationId: c.get("organizationId")! },
  });
  return c.json(team, 201);
});

directoryRoutes.patch("/teams/:id", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z.object({ name: z.string().min(1) }).parse(await c.req.json());
  const existing = await c.get("db").team.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const updated = await c.get("db").team.update({
    where: { id: existing.id },
    data: { name: body.name },
  });
  return c.json(updated);
});

directoryRoutes.delete("/teams/:id", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const existing = await c.get("db").team.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").team.delete({ where: { id: existing.id } });
  return c.json({ success: true });
});

directoryRoutes.post("/teams/:id/members", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z.object({ userId: z.string() }).parse(await c.req.json());
  const team = await c.get("db").team.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!team) return c.json({ error: "NOT_FOUND" }, 404);

  const member = await c.get("db").teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: body.userId } },
    create: { teamId: team.id, userId: body.userId },
    update: {},
  });
  return c.json(member, 201);
});

directoryRoutes.delete("/teams/:id/members/:userId", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const team = await c.get("db").team.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!team) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").teamMember.deleteMany({
    where: { teamId: team.id, userId: c.req.param("userId") },
  });
  return c.json({ success: true });
});

// --- Memberships & Invites ---
directoryRoutes.get("/members", async (c) => {
  const organizationId = c.get("organizationId")!;
  const members = await c.get("db").membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ members });
});

directoryRoutes.patch("/members/:id", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z
    .object({ role: z.enum(["OWNER", "ADMIN", "ENGINEER", "DEVELOPER", "VIEWER", "BILLING"]) })
    .parse(await c.req.json());

  const existing = await c.get("db").membership.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  const updated = await c.get("db").membership.update({
    where: { id: existing.id },
    data: { role: body.role },
  });
  return c.json(updated);
});

directoryRoutes.delete("/members/:id", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const existing = await c.get("db").membership.findFirst({
    where: { id: c.req.param("id"), organizationId },
  });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);

  await c.get("db").membership.delete({ where: { id: existing.id } });
  return c.json({ success: true });
});

directoryRoutes.get("/invites", async (c) => {
  const organizationId = c.get("organizationId")!;
  const invites = await c.get("db").organizationInvite.findMany({
    where: { organizationId },
    include: { invitedBy: { select: { id: true, name: true, email: true } } },
  });
  return c.json({ invites });
});

directoryRoutes.post("/invites", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  const body = z
    .object({
      email: z.string().email(),
      role: z.enum(["OWNER", "ADMIN", "ENGINEER", "DEVELOPER", "VIEWER", "BILLING"]).default("ENGINEER"),
    })
    .parse(await c.req.json());

  const rawToken = randomToken(32);
  const invite = await c.get("db").organizationInvite.upsert({
    where: { organizationId_email: { organizationId, email: body.email.toLowerCase() } },
    create: {
      organizationId,
      email: body.email.toLowerCase(),
      role: body.role,
      tokenHash: sha256(rawToken),
      invitedById: c.get("userId")!,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    },
    update: {
      role: body.role,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    },
  });

  return c.json({ ...invite, inviteToken: rawToken }, 201);
});

directoryRoutes.delete("/invites/:id", requireRole("ADMIN"), async (c) => {
  const organizationId = c.get("organizationId")!;
  await c.get("db").organizationInvite.deleteMany({
    where: { id: c.req.param("id"), organizationId },
  });
  return c.json({ success: true });
});
