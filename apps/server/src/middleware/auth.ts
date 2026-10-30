import { createMiddleware } from "hono/factory";
import { verifySession } from "../lib/crypto";
import type { AppEnv } from "../types";

// Global optional auth — extracts JWT from Bearer header or session cookie
export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  c.set("requestId", crypto.randomUUID());

  const authHeader = c.req.header("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearer && !bearer.startsWith("strim_")) {
    const session = verifySession(bearer);
    if (session) {
      const db = c.get("db");
      if (db) {
        try {
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { id: true, email: true },
          });
          if (user) {
            c.set("userId", user.id);
            c.set("email", user.email);
            c.set("sessionId", session.sessionId);
          }
        } catch {
          // DB error, do not set invalid userId
        }
      }
    }
  }

  await next();
});

// Require authenticated user
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("userId")) {
    return c.json(
      {
        code: "UNAUTHORIZED",
        message: "Authentication required. Provide a valid Bearer token.",
        requestId: c.get("requestId"),
      },
      401,
    );
  }
  await next();
});
