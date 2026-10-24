import { createMiddleware } from "hono/factory";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../types";

export function requireRole(min: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("role");
    if (!role || !roleAtLeast(role, min)) {
      return c.json({ error: "FORBIDDEN", message: `Requires ${min} permission` }, 403);
    }
    await next();
  });
}
