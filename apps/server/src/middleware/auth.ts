import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { verifySession } from "../lib/crypto";

export const optionalAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  const cookie = c.req.header("cookie") ?? "";
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = cookie.match(/(?:^|;\s*)strim_session=([^;]+)/)?.[1] ?? null;
  const token = bearer ?? cookieToken;

  if (token && !token.startsWith("sk_")) {
    const session = verifySession(token);
    if (session) {
      // If session record exists in token, verify it's still active in DB
      if (session.sessionId) {
        try {
          const dbSession = await c.get("db").session.findUnique({
            where: { id: session.sessionId },
          });
          if (!dbSession || dbSession.expiresAt < new Date()) {
            await next();
            return;
          }
        } catch {
          // In case DB session lookup fails, fall through
        }
      }
      c.set("userId", session.userId);
      c.set("email", session.email);
    }
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("userId")) {
    return c.json({ error: "UNAUTHORIZED", message: "Sign in required" }, 401);
  }
  await next();
});
