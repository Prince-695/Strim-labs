import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import {
  hashPassword,
  randomToken,
  sha256,
  signSession,
  validatePasswordComplexity,
  verifyPassword,
  verifySession,
} from "../lib/crypto";
import { writeAudit } from "../lib/audit";
import { rateLimit } from "../lib/redis";

export const authRoutes = new Hono<AppEnv>();

function setSessionCookie(c: { header: (k: string, v: string) => void }, token: string, maxAgeSeconds = 7 * 86400) {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  c.header(
    "Set-Cookie",
    `strim_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`,
  );
}

function clearSessionCookie(c: { header: (k: string, v: string) => void }) {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  c.header("Set-Cookie", `strim_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

authRoutes.post("/signup", async (c) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
      organizationName: z.string().min(1),
    })
    .parse(await c.req.json());

  const complexity = validatePasswordComplexity(body.password);
  if (!complexity.valid) {
    return c.json({ error: "VALIDATION", message: complexity.message }, 400);
  }

  const db = c.get("db");
  const existing = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) {
    return c.json({ error: "CONFLICT", message: "Email is already registered" }, 409);
  }

  const user = await db.user.create({
    data: {
      email: body.email.toLowerCase(),
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

  const sessionRecord = await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(randomToken()),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const token = await signSession({
    userId: user.id,
    email: user.email,
    sessionId: sessionRecord.id,
  });

  setSessionCookie(c, token);

  return c.json(
    {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: org,
    },
    201,
  );
});

authRoutes.post("/login", async (c) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).parse(await c.req.json());
  const emailKey = body.email.toLowerCase();

  const ip = c.req.header("x-forwarded-for") ?? "local";
  const rl = await rateLimit(`login:${ip}:${emailKey}`, 5, 900);
  if (!rl.allowed) {
    return c.json(
      {
        error: "RATE_LIMITED",
        message: "Too many login attempts. Please wait 15 minutes before trying again.",
      },
      429,
    );
  }

  const db = c.get("db");
  const user = await db.user.findUnique({ where: { email: emailKey } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return c.json({ error: "UNAUTHORIZED", message: "Invalid email or password" }, 401);
  }

  const sessionRecord = await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(randomToken()),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const token = await signSession({
    userId: user.id,
    email: user.email,
    sessionId: sessionRecord.id,
  });

  setSessionCookie(c, token);

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

authRoutes.post("/logout", async (c) => {
  const header = c.req.header("authorization");
  const cookie = c.req.header("cookie") ?? "";
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = cookie.match(/(?:^|;\s*)strim_session=([^;]+)/)?.[1] ?? null;
  const token = bearer ?? cookieToken;

  if (token) {
    const session = verifySession(token);
    if (session?.sessionId) {
      try {
        await c.get("db").session.delete({ where: { id: session.sessionId } });
      } catch {
        // ignore if already deleted
      }
    }
  }

  clearSessionCookie(c);
  return c.json({ success: true, message: "Logged out successfully" });
});

authRoutes.post("/refresh", async (c) => {
  const header = c.req.header("authorization");
  const cookie = c.req.header("cookie") ?? "";
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = cookie.match(/(?:^|;\s*)strim_session=([^;]+)/)?.[1] ?? null;
  const token = bearer ?? cookieToken;

  if (!token) return c.json({ error: "UNAUTHORIZED", message: "No active session" }, 401);
  const session = verifySession(token);
  if (!session) return c.json({ error: "UNAUTHORIZED", message: "Session expired or invalid" }, 401);

  const db = c.get("db");
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "UNAUTHORIZED", message: "User not found" }, 401);

  const newExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  if (session.sessionId) {
    await db.session.update({
      where: { id: session.sessionId },
      data: { expiresAt: newExpiry },
    });
  }

  const newToken = await signSession({
    userId: user.id,
    email: user.email,
    sessionId: session.sessionId,
  });

  setSessionCookie(c, newToken);
  return c.json({ token: newToken });
});

authRoutes.post("/forgot-password", async (c) => {
  const body = z.object({ email: z.string().email() }).parse(await c.req.json());
  const db = c.get("db");
  const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });

  if (user) {
    const resetToken = randomToken(32);
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(resetToken),
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
      },
    });

    return c.json({
      message: "If that email exists, password reset instructions have been generated.",
      resetToken, // Provided for developer convenience / demo environments
    });
  }

  return c.json({
    message: "If that email exists, password reset instructions have been generated.",
  });
});

authRoutes.post("/reset-password", async (c) => {
  const body = z
    .object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    })
    .parse(await c.req.json());

  const complexity = validatePasswordComplexity(body.newPassword);
  if (!complexity.valid) {
    return c.json({ error: "VALIDATION", message: complexity.message }, 400);
  }

  const db = c.get("db");
  const tokenRecord = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(body.token) },
  });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    return c.json({ error: "UNAUTHORIZED", message: "Password reset token is invalid or expired" }, 400);
  }

  const newHash = await hashPassword(body.newPassword);
  await db.user.update({
    where: { id: tokenRecord.userId },
    data: { passwordHash: newHash },
  });

  // Revoke all existing sessions for safety
  await db.session.deleteMany({ where: { userId: tokenRecord.userId } });
  // Delete used reset token
  await db.passwordResetToken.delete({ where: { id: tokenRecord.id } });

  return c.json({ success: true, message: "Password has been successfully updated. Please sign in." });
});

authRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);
  const db = c.get("db");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
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

authRoutes.patch("/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);
  const body = z.object({ name: z.string().min(1) }).parse(await c.req.json());

  const updated = await c.get("db").user.update({
    where: { id: userId },
    data: { name: body.name },
    select: { id: true, email: true, name: true },
  });

  return c.json(updated);
});

authRoutes.post("/change-password", async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = z
    .object({
      currentPassword: z.string(),
      newPassword: z.string().min(8),
    })
    .parse(await c.req.json());

  const complexity = validatePasswordComplexity(body.newPassword);
  if (!complexity.valid) {
    return c.json({ error: "VALIDATION", message: complexity.message }, 400);
  }

  const db = c.get("db");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return c.json({ error: "UNAUTHORIZED", message: "Current password is incorrect" }, 401);
  }

  const newHash = await hashPassword(body.newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  return c.json({ success: true, message: "Password updated successfully" });
});
