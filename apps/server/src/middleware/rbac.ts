import { createMiddleware } from "hono/factory";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../types";

/** Guard route access to users with at least the specified role */
export function requireRole(min: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get("role");
    if (!role || !roleAtLeast(role, min)) {
      return c.json(
        {
          code: "FORBIDDEN",
          message: `This action requires ${min} role or higher`,
          requestId: c.get("requestId"),
        },
        403,
      );
    }
    await next();
  });
}
