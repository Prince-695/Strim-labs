import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { AuthService } from "./service";
import type {
  changePasswordRoute,
  forgotPasswordRoute,
  getMeRoute,
  googleCallbackRoute,
  googleUrlRoute,
  loginRoute,
  logoutRoute,
  refreshRoute,
  resetPasswordRoute,
  signUpRoute,
  updateMeRoute,
} from "./routes";

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

function extractToken(c: { req: { header: (n: string) => string | undefined } }): string | null {
  const header = c.req.header("authorization");
  const cookie = c.req.header("cookie") ?? "";
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = cookie.match(/(?:^|;\s*)strim_session=([^;]+)/)?.[1] ?? null;
  return bearer ?? cookieToken;
}

export const signUpHandler: RouteHandler<typeof signUpRoute, AppEnv> = async (c) => {
  const body = c.req.valid("json");
  const result = await AuthService.signUp(c.get("db"), body);

  if (result.status === 201 && "token" in result.data) {
    setSessionCookie(c, result.data.token);
  }

  return c.json(result.data as any, result.status as any);
};

export const loginHandler: RouteHandler<typeof loginRoute, AppEnv> = async (c) => {
  const body = c.req.valid("json");
  const ip = c.req.header("x-forwarded-for") ?? "local";
  const result = await AuthService.login(c.get("db"), body, ip);

  if (result.status === 200 && "token" in result.data) {
    setSessionCookie(c, result.data.token);
  }

  return c.json(result.data as any, result.status as any);
};

export const googleUrlHandler: RouteHandler<typeof googleUrlRoute, AppEnv> = async (c) => {
  const url = AuthService.getGoogleAuthUrl();
  return c.json({ url }, 200);
};

export const googleCallbackHandler: RouteHandler<typeof googleCallbackRoute, AppEnv> = async (c) => {
  const { code } = c.req.valid("json");
  const result = await AuthService.handleGoogleCallback(c.get("db"), code);

  if (result.status === 200 && "token" in result.data) {
    setSessionCookie(c, result.data.token);
  }

  return c.json(result.data as any, result.status as any);
};

export const logoutHandler: RouteHandler<typeof logoutRoute, AppEnv> = async (c) => {
  const token = extractToken(c);
  await AuthService.logout(c.get("db"), token);
  clearSessionCookie(c);
  return c.json({ success: true, message: "Logged out successfully" }, 200);
};

export const refreshHandler: RouteHandler<typeof refreshRoute, AppEnv> = async (c) => {
  const token = extractToken(c);
  if (!token) {
    return c.json({ error: "UNAUTHORIZED", message: "No active session" }, 401);
  }

  const result = await AuthService.refreshSession(c.get("db"), token);
  if (result.status === 200 && "token" in result.data) {
    setSessionCookie(c, result.data.token);
  }

  return c.json(result.data as any, result.status as any);
};

export const forgotPasswordHandler: RouteHandler<typeof forgotPasswordRoute, AppEnv> = async (c) => {
  const { email } = c.req.valid("json");
  const result = await AuthService.forgotPassword(c.get("db"), email);
  return c.json(result, 200);
};

export const resetPasswordHandler: RouteHandler<typeof resetPasswordRoute, AppEnv> = async (c) => {
  const { token, newPassword } = c.req.valid("json");
  const result = await AuthService.resetPassword(c.get("db"), token, newPassword);
  return c.json(result.data as any, result.status as any);
};

export const getMeHandler: RouteHandler<typeof getMeRoute, AppEnv> = async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "UNAUTHORIZED", message: "Not authenticated" }, 401);
  }

  const result = await AuthService.getProfile(c.get("db"), userId);
  return c.json(result as any, 200);
};

export const updateMeHandler: RouteHandler<typeof updateMeRoute, AppEnv> = async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "UNAUTHORIZED", message: "Not authenticated" }, 401);
  }

  const { name } = c.req.valid("json");
  const updated = await AuthService.updateProfile(c.get("db"), userId, name);
  return c.json(updated, 200);
};

export const changePasswordHandler: RouteHandler<typeof changePasswordRoute, AppEnv> = async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: "UNAUTHORIZED", message: "Not authenticated" }, 401);
  }

  const { currentPassword, newPassword } = c.req.valid("json");
  const result = await AuthService.changePassword(c.get("db"), userId, currentPassword, newPassword);
  return c.json(result.data as any, result.status as any);
};
