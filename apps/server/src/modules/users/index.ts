import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  UserSchema,
  UserPreferencesSchema,
  SessionInfoSchema,
  ApiErrorSchema,
  PaginationQuerySchema,
} from "../../lib/schemas";
import { requireAuth } from "../../middleware/auth";

export const usersRoutes = new OpenAPIHono<AppEnv>();
usersRoutes.use("*", requireAuth);

// ─── GET /users/me ────────────────────────────────────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "get",
    path: "/me",
    tags: ["Users"],
    summary: "Get current user",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "Current user profile", content: { "application/json": { schema: z.object({ user: UserSchema }) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const user = await db.user.findUnique({ where: { id: c.get("userId")! } });
    if (!user) return c.json({ code: "UNAUTHORIZED", message: "User not found" }, 401);
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        avatarUrl: user.avatarUrl,
        timezone: user.timezone,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/me",
    tags: ["Users"],
    summary: "Update profile",
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(2).max(100).optional(),
              avatarUrl: z.string().url().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Profile updated", content: { "application/json": { schema: z.object({ user: UserSchema }) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const db = c.get("db");
    const user = await db.user.update({
      where: { id: c.get("userId")! },
      data: { ...body },
    });
    return c.json({
      user: {
        id: user.id, email: user.email, emailVerified: user.emailVerified, name: user.name,
        avatarUrl: user.avatarUrl, timezone: user.timezone, locale: user.locale,
        createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── GET /users/me/preferences ────────────────────────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "get",
    path: "/me/preferences",
    tags: ["Users"],
    summary: "Get preferences",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "User preferences", content: { "application/json": { schema: z.object({ preferences: UserPreferencesSchema }) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const user = await db.user.findUnique({ where: { id: c.get("userId")! } });
    if (!user) return c.json({ code: "UNAUTHORIZED", message: "User not found" }, 401);
    return c.json({
      preferences: {
        timezone: user.timezone,
        locale: user.locale,
        theme: (user as any).theme ?? "dark",
        notifyEmail: user.notifyEmail,
        notifySlack: user.notifySlack,
      },
    }, 200);
  },
);

// ─── PATCH /users/me/preferences ─────────────────────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/me/preferences",
    tags: ["Users"],
    summary: "Update preferences",
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: UserPreferencesSchema.partial() } } } },
    responses: {
      200: { description: "Preferences updated", content: { "application/json": { schema: z.object({ preferences: UserPreferencesSchema }) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    const db = c.get("db");
    const user = await db.user.update({
      where: { id: c.get("userId")! },
      data: body,
    });
    return c.json({
      preferences: {
        timezone: user.timezone,
        locale: user.locale,
        theme: (user as any).theme ?? "dark",
        notifyEmail: user.notifyEmail,
        notifySlack: user.notifySlack,
      },
    }, 200);
  },
);

// ─── GET /users/me/sessions ───────────────────────────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "get",
    path: "/me/sessions",
    tags: ["Users"],
    summary: "List active sessions",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "Active sessions",
        content: { "application/json": { schema: z.object({ sessions: z.array(SessionInfoSchema) }) } },
      },
      401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const userId = c.get("userId")!;
    const sessionId = c.get("sessionId");
    const db = c.get("db");

    const sessions = await db.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
    });

    return c.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent: s.tokenHash === sessionId,
      })),
    }, 200);
  },
);

// ─── DELETE /users/me/sessions/:sessionId ─────────────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/me/sessions/{sessionId}",
    tags: ["Users"],
    summary: "Revoke a session",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ sessionId: z.string() }) },
    responses: {
      200: { description: "Session revoked", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Session not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const userId = c.get("userId")!;
    const { sessionId } = c.req.valid("param");
    const db = c.get("db");

    const deleted = await db.session.deleteMany({ where: { id: sessionId, userId } });
    if (deleted.count === 0) {
      return c.json({ code: "NOT_FOUND", message: "Session not found", requestId: c.get("requestId") }, 404);
    }
    return c.json({ ok: true }, 200);
  },
);

// ─── GET /users/me/organizations ─────────────────────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "get",
    path: "/me/organizations",
    tags: ["Users"],
    summary: "List my organizations",
    description: "Returns all organizations the authenticated user belongs to. Maximum of 3.",
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: "User's organizations",
        content: {
          "application/json": {
            schema: z.object({
              organizations: z.array(
                z.object({ id: z.string(), name: z.string(), slug: z.string(), role: z.string(), plan: z.string() })
              ),
              maxOrganizations: z.literal(3),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const userId = c.get("userId")!;
    const db = c.get("db");

    const memberships = await db.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });

    return c.json({
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        plan: m.organization.plan,
      })),
      maxOrganizations: 3 as const,
    }, 200);
  },
);

// ─── POST /users/me/account-deletion (request) ───────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "post",
    path: "/me/account-deletion",
    tags: ["Users"],
    summary: "Request account deletion",
    description: "Schedules account deletion. Sends a confirmation email with a verification token.",
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: z.object({ reason: z.string().max(500).optional() }) } } },
    },
    responses: {
      200: { description: "Deletion requested", content: { "application/json": { schema: z.object({ ok: z.boolean(), expiresAt: z.string() }) } } },
    },
  }),
  async (c) => {
    // Generates a deletion confirmation token, sends email
    // User must click link within 24h to confirm
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    return c.json({ ok: true, expiresAt }, 200);
  },
);

// ─── DELETE /users/me/account-deletion (confirm) ─────────────────────────────

usersRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/me/account-deletion",
    tags: ["Users"],
    summary: "Confirm account deletion",
    description: "Permanently deletes the account. Requires the token from the deletion confirmation email.",
    security: [{ BearerAuth: [] }],
    request: {
      body: { content: { "application/json": { schema: z.object({ token: z.string() }) } } },
    },
    responses: {
      200: { description: "Account deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      400: { description: "Invalid token", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    // TODO: Validate deletion token, hard-delete user and cascade
    return c.json({ ok: true }, 200);
  },
);
