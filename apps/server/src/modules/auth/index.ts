import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types";
import { hashPassword, randomToken, sha256, signSession, verifyPassword } from "../../lib/crypto";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organizationName: z.string().min(2),
});

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = c.get("db");

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  if (!user) {
    return c.json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" }, 401);
  }

  const token = await signSession({ userId: user.id, email: user.email });
  const orgs = user.memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    orgs,
  });
});

authRoutes.post("/signup", zValidator("json", signupSchema), async (c) => {
  const { email, password, name, organizationName } = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return c.json({ error: "USER_EXISTS", message: "An account with this email already exists" }, 409);
  }

  const passwordHash = await hashPassword(password);
  const slug = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `org-${randomToken(4)}`;

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash,
    },
  });

  const org = await db.organization.create({
    data: {
      name: organizationName,
      slug: `${slug}-${randomToken(3)}`,
      memberships: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  const token = await signSession({ userId: user.id, email: user.email });

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    orgs: [{ id: org.id, name: org.name, slug: org.slug, role: "OWNER" }],
  });
});

authRoutes.get("/me", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "UNAUTHORIZED", message: "Sign in required" }, 401);
  }

  const db = c.get("db");
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  if (!user) {
    return c.json({ error: "NOT_FOUND", message: "User not found" }, 404);
  }

  const orgs = user.memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));

  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    orgs,
  });
});
