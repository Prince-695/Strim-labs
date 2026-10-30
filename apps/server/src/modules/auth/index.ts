import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import {
  SignUpSchema,
  SignInSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  VerifyEmailSchema,
  AuthResponseSchema,
  UserSchema,
  SessionInfoSchema,
  ApiErrorSchema,
} from "../../lib/schemas";
import {
  hashPassword,
  verifyPassword,
  randomToken,
  sha256,
  signSession,
  validatePasswordComplexity,
} from "../../lib/crypto";
import { requireAuth } from "../../middleware/auth";

export const authRoutes = new OpenAPIHono<AppEnv>();

// ─── POST /auth/sign-up ───────────────────────────────────────────────────────

const signUpRoute = createRoute({
  method: "post",
  path: "/sign-up",
  tags: ["Authentication"],
  summary: "Create account",
  description:
    "Register a new user and their first organization. Enforces a maximum of 3 organization memberships per user.",
  request: { body: { content: { "application/json": { schema: SignUpSchema } }, required: true } },
  responses: {
    201: { description: "Account created", content: { "application/json": { schema: AuthResponseSchema } } },
    409: { description: "Email already registered", content: { "application/json": { schema: ApiErrorSchema } } },
    422: { description: "Validation error", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.openapi(signUpRoute, async (c) => {
  const { name, email, password, organizationName } = c.req.valid("json");
  const db = c.get("db");
  const reqId = c.get("requestId");

  const complexity = validatePasswordComplexity(password);
  if (!complexity.valid) {
    return c.json({ code: "VALIDATION_ERROR", message: complexity.message!, requestId: reqId }, 422);
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return c.json({ code: "CONFLICT", message: "An account with this email already exists", requestId: reqId }, 409);
  }

  const passwordHash = await hashPassword(password);
  const baseSlug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "org";
  const slug = `${baseSlug}-${randomToken(3)}`;

  const user = await db.user.create({
    data: { email: email.toLowerCase(), name, passwordHash },
  });

  const org = await db.organization.create({
    data: {
      name: organizationName,
      slug,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const sessionToken = randomToken(40);
  const tokenHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await db.session.create({
    data: { userId: user.id, tokenHash, expiresAt, ipAddress: c.req.header("x-forwarded-for") ?? null },
  });

  const accessToken = await signSession({ userId: user.id, email: user.email, sessionId: tokenHash });

  await db.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: "CREATE",
      resourceType: "User",
      resourceId: user.id,
    },
  });

  return c.json({
    accessToken,
    tokenType: "Bearer" as const,
    expiresIn: 7 * 24 * 3600,
    user: {
      id: user.id,
      email: user.email,
      emailVerified: false,
      name: user.name,
      avatarUrl: null,
      timezone: user.timezone,
      locale: user.locale,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  }, 201);
});

// ─── POST /auth/sign-in ───────────────────────────────────────────────────────

const signInRoute = createRoute({
  method: "post",
  path: "/sign-in",
  tags: ["Authentication"],
  summary: "Sign in",
  description: "Authenticate with email and password. Returns a Bearer access token.",
  request: { body: { content: { "application/json": { schema: SignInSchema } }, required: true } },
  responses: {
    200: { description: "Signed in", content: { "application/json": { schema: AuthResponseSchema } } },
    401: { description: "Invalid credentials", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.openapi(signInRoute, async (c) => {
  const { email, password, rememberMe } = c.req.valid("json");
  const db = c.get("db");
  const reqId = c.get("requestId");

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) {
    return c.json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password", requestId: reqId }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password", requestId: reqId }, 401);
  }

  const ttlMs = rememberMe ? 30 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
  const sessionToken = randomToken(40);
  const tokenHash = sha256(sessionToken);
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: c.req.header("user-agent") ?? null,
      ipAddress: c.req.header("x-forwarded-for") ?? null,
    },
  });

  const accessToken = await signSession({ userId: user.id, email: user.email, sessionId: tokenHash }, ttlMs);

  return c.json({
    accessToken,
    tokenType: "Bearer" as const,
    expiresIn: ttlMs / 1000,
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
});

// ─── POST /auth/sign-out, /auth/log-out, /auth/lou-out ──────────────────────────

const signOutRoute = createRoute({
  method: "post",
  path: "/sign-out",
  tags: ["Authentication"],
  summary: "Sign out",
  description: "Revoke the current session token.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Signed out", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

const logOutRoute = createRoute({
  method: "post",
  path: "/log-out",
  tags: ["Authentication"],
  summary: "Log out",
  description: "Revoke the current session token.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Logged out", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

const louOutRoute = createRoute({
  method: "post",
  path: "/lou-out",
  tags: ["Authentication"],
  summary: "Log out (spec alias)",
  description: "Revoke the current session token.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Logged out", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

const handleSignOut = async (c: any) => {
  const sessionId = c.get("sessionId");
  if (sessionId) {
    await c.get("db").session.deleteMany({ where: { tokenHash: sessionId } }).catch(() => {});
  }
  return c.json({ ok: true }, 200);
};

authRoutes.openapi(signOutRoute, handleSignOut);
authRoutes.openapi(logOutRoute, handleSignOut);
authRoutes.openapi(louOutRoute, handleSignOut);

// ─── GET /auth/session ────────────────────────────────────────────────────────

const getSessionRoute = createRoute({
  method: "get",
  path: "/session",
  tags: ["Authentication"],
  summary: "Get session",
  description: "Returns the authenticated user and their organization memberships.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Current session",
      content: {
        "application/json": {
          schema: z.object({
            user: UserSchema,
            orgs: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                slug: z.string(),
                role: z.string(),
              })
            ),
          }),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.use("/session", requireAuth);
authRoutes.openapi(getSessionRoute, async (c) => {
  const userId = c.get("userId")!;
  const db = c.get("db");

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { organization: true } } },
  });

  if (!user) {
    return c.json({ code: "NOT_FOUND", message: "User not found", requestId: c.get("requestId") }, 404 as any);
  }

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
    orgs: user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  }, 200);
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

const refreshRoute = createRoute({
  method: "post",
  path: "/refresh",
  tags: ["Authentication"],
  summary: "Refresh token",
  description: "Extend the current session and return a fresh access token.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Token refreshed", content: { "application/json": { schema: z.object({ accessToken: z.string(), expiresIn: z.number() }) } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.use("/refresh", requireAuth);
authRoutes.openapi(refreshRoute, async (c) => {
  const userId = c.get("userId")!;
  const email = c.get("email")!;
  const sessionId = c.get("sessionId");
  const db = c.get("db");

  if (sessionId) {
    await db.session.updateMany({
      where: { tokenHash: sessionId, userId },
      data: { lastActiveAt: new Date(), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
    });
  }

  const accessToken = await signSession({ userId, email });
  return c.json({ accessToken, expiresIn: 7 * 24 * 3600 }, 200);
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

const forgotPasswordRoute = createRoute({
  method: "post",
  path: "/forgot-password",
  tags: ["Authentication"],
  summary: "Request password reset",
  description: "Sends a password reset email if the account exists. Always returns 200 to prevent enumeration.",
  request: { body: { content: { "application/json": { schema: ForgotPasswordSchema } }, required: true } },
  responses: {
    200: { description: "Reset email sent (if account exists)", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
  },
});

authRoutes.openapi(forgotPasswordRoute, async (c) => {
  const { email } = c.req.valid("json");
  const db = c.get("db");

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    const token = randomToken(32);
    const tokenHash = sha256(token);
    await db.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "password_reset",
        expiresAt: new Date(Date.now() + 2 * 3600 * 1000),
      },
    });
    // TODO: Queue email with reset link: /auth/reset-password?token=<token>
    console.log(`[DEV] Password reset token for ${email}: ${token}`);
  }

  return c.json({ ok: true }, 200);
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────

const resetPasswordRoute = createRoute({
  method: "post",
  path: "/reset-password",
  tags: ["Authentication"],
  summary: "Reset password",
  description: "Set a new password using a valid reset token.",
  request: { body: { content: { "application/json": { schema: ResetPasswordSchema } }, required: true } },
  responses: {
    200: { description: "Password reset", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    400: { description: "Invalid or expired token", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.openapi(resetPasswordRoute, async (c) => {
  const { token, newPassword } = c.req.valid("json");
  const db = c.get("db");
  const reqId = c.get("requestId");

  const tokenHash = sha256(token);
  const vt = await db.verificationToken.findUnique({
    where: { tokenHash },
  });

  if (!vt || vt.type !== "password_reset" || vt.expiresAt < new Date() || vt.usedAt) {
    return c.json({ code: "INVALID_TOKEN", message: "Reset token is invalid or has expired", requestId: reqId }, 400);
  }

  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    return c.json({ code: "VALIDATION_ERROR", message: complexity.message!, requestId: reqId }, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: vt.userId }, data: { passwordHash } });
  await db.verificationToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });
  // Revoke all sessions after password reset
  await db.session.deleteMany({ where: { userId: vt.userId } });

  return c.json({ ok: true }, 200);
});

// ─── POST /auth/verify-email ──────────────────────────────────────────────────

const verifyEmailRoute = createRoute({
  method: "post",
  path: "/verify-email",
  tags: ["Authentication"],
  summary: "Verify email address",
  description: "Confirm email ownership using the token from the verification email.",
  request: { body: { content: { "application/json": { schema: VerifyEmailSchema } }, required: true } },
  responses: {
    200: { description: "Email verified", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    400: { description: "Invalid or expired token", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.openapi(verifyEmailRoute, async (c) => {
  const { token } = c.req.valid("json");
  const db = c.get("db");
  const reqId = c.get("requestId");

  const tokenHash = sha256(token);
  const vt = await db.verificationToken.findUnique({ where: { tokenHash } });

  if (!vt || vt.type !== "email_verification" || vt.expiresAt < new Date() || vt.usedAt) {
    return c.json({ code: "INVALID_TOKEN", message: "Verification token is invalid or has expired", requestId: reqId }, 400);
  }

  await db.user.update({ where: { id: vt.userId }, data: { emailVerified: true } });
  await db.verificationToken.update({ where: { tokenHash }, data: { usedAt: new Date() } });

  return c.json({ ok: true }, 200);
});

// ─── POST /auth/resend-verification ──────────────────────────────────────────

const resendVerificationRoute = createRoute({
  method: "post",
  path: "/resend-verification",
  tags: ["Authentication"],
  summary: "Resend verification email",
  description: "Send a new email verification link to the authenticated user.",
  security: [{ BearerAuth: [] }],
  responses: {
    200: { description: "Verification email sent", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    400: { description: "Email already verified", content: { "application/json": { schema: ApiErrorSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.use("/resend-verification", requireAuth);
authRoutes.openapi(resendVerificationRoute, async (c) => {
  const userId = c.get("userId")!;
  const db = c.get("db");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return c.json({ code: "NOT_FOUND", message: "User not found", requestId: c.get("requestId") }, 404 as any);
  if (user.emailVerified) return c.json({ code: "ALREADY_VERIFIED", message: "Email is already verified", requestId: c.get("requestId") }, 400);

  const token = randomToken(32);
  const tokenHash = sha256(token);
  await db.verificationToken.create({
    data: { userId, tokenHash, type: "email_verification", expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
  });

  // TODO: Queue verification email
  console.log(`[DEV] Email verification token for ${user.email}: ${token}`);
  return c.json({ ok: true }, 200);
});

// ─── POST /auth/change-password ───────────────────────────────────────────────

const changePasswordRoute = createRoute({
  method: "post",
  path: "/change-password",
  tags: ["Authentication"],
  summary: "Change password",
  description: "Update password while authenticated. Revokes all other active sessions.",
  security: [{ BearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: ChangePasswordSchema } }, required: true } },
  responses: {
    200: { description: "Password changed", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
    400: { description: "Incorrect current password or complexity failure", content: { "application/json": { schema: ApiErrorSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  },
});

authRoutes.use("/change-password", requireAuth);
authRoutes.openapi(changePasswordRoute, async (c) => {
  const userId = c.get("userId")!;
  const sessionId = c.get("sessionId");
  const { currentPassword, newPassword } = c.req.valid("json");
  const db = c.get("db");
  const reqId = c.get("requestId");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) return c.json({ code: "UNAUTHORIZED", message: "Cannot change password for OAuth accounts", requestId: reqId }, 400);

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return c.json({ code: "INVALID_CREDENTIALS", message: "Current password is incorrect", requestId: reqId }, 400);

  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) return c.json({ code: "VALIDATION_ERROR", message: complexity.message!, requestId: reqId }, 400);

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
  // Revoke all OTHER sessions, keep current
  await db.session.deleteMany({
    where: { userId, ...(sessionId ? { NOT: { tokenHash: sessionId } } : {}) },
  });

  return c.json({ ok: true }, 200);
});
