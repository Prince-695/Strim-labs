import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { hashPassword, signSession, verifyPassword } from "../lib/crypto";
import { writeAudit } from "../lib/audit";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/signup", async (c) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
      organizationName: z.string().min(1),
    })
    .parse(await c.req.json());
  const db = c.get("db");
  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) return c.json({ error: "CONFLICT", message: "Email in use" }, 409);

  const user = await db.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
    },
  });
  const slug = body.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const org = await db.organization.create({
    data: { name: body.organizationName, slug: `${slug}-${user.id.slice(-6)}` },
  });
  const team = await db.team.create({
    data: { organizationId: org.id, name: "Platform" },
  });
  await db.teamMember.create({ data: { teamId: team.id, userId: user.id } });
  await db.membership.create({
    data: { organizationId: org.id, userId: user.id, role: "OWNER", scope: "ORGANIZATION" },
  });
  await db.billingAccount.create({ data: { organizationId: org.id, plan: "team" } });
  await writeAudit(db, {
    organizationId: org.id,
    actorId: user.id,
    action: "organization.create",
    resourceType: "organization",
    resourceId: org.id,
    newValue: { name: org.name },
  });
  const token = await signSession({ userId: user.id, email: user.email });
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name }, organization: org });
});

authRoutes.post("/login", async (c) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).parse(await c.req.json());
  const db = c.get("db");
  const user = await db.user.findUnique({ where: { email: body.email } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return c.json({ error: "UNAUTHORIZED", message: "Invalid credentials" }, 401);
  }
  const token = await signSession({ userId: user.id, email: user.email });
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
  });
  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  });
});

authRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);
  const db = c.get("db");
  const user = await db.user.findUnique({ where: { id: userId } });
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { organization: true },
  });
  return c.json({
    user,
    organizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  });
});
