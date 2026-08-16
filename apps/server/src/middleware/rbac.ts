import { createMiddleware } from "hono/factory";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../types";

export function requireRole(min: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("role");
    if (!role || !roleAtLeast(role, min)) {
      return c.json({ error: "FORBIDDEN", message: `Requires ${min}` }, 403);
    }
    await next();
  });
}

export function requireAnyRole(roles: Role[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("role");
    if (!role || (!roles.includes(role) && !roleAtLeast(role, "ADMIN"))) {
      return c.json({ error: "FORBIDDEN", message: `Requires ${roles.join(" or ")}` }, 403);
    }
    await next();
  });
}

export function requireProductionTier() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("role");
    const envType = c.req.header("x-environment-type") ?? c.req.query("environmentType");
    if (envType === "PRODUCTION" && role && !roleAtLeast(role, "ENGINEER")) {
      return c.json(
        { error: "FORBIDDEN", message: "Production-tier action requires Engineer or above" },
        403,
      );
    }
    await next();
  });
}
