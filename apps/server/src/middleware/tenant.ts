import { createMiddleware } from "hono/factory";
import type { Role } from "@strim/shared";
import type { AppEnv } from "../types";

// Short 60s memory cache to prevent database connection pool storms on concurrent requests
const membershipCache = new Map<string, { role: Role; expiresAt: number }>();

export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
  const orgId =
    c.req.header("x-organization-id") ??
    c.req.query("organizationId") ??
    c.req.param("organizationId");
  const userId = c.get("userId");
  
  if (!orgId) {
    return c.json({ error: "VALIDATION", message: "organizationId required" }, 400);
  }

  if (userId) {
    const cacheKey = `${orgId}:${userId}`;
    const cached = membershipCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      c.set("role", cached.role);
      c.set("organizationId", orgId);
      await next();
      return;
    }

    const db = c.get("db");
    const membership = await db.membership.findFirst({
      where: { organizationId: orgId, userId },
    });

    if (!membership && !c.get("apiKeyId")) {
      return c.json({ error: "TENANT_MISMATCH", message: "No access to this organization" }, 403);
    }

    if (membership) {
      const role = membership.role as Role;
      membershipCache.set(cacheKey, { role, expiresAt: Date.now() + 60000 });
      c.set("role", role);
    }
  } else if (!c.get("apiKeyId")) {
    return c.json({ error: "UNAUTHORIZED", message: "Authentication required" }, 401);
  }

  c.set("organizationId", orgId);
  await next();
});

export function assertOrg(resourceOrgId: string, requestOrgId: string): void {
  if (resourceOrgId !== requestOrgId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
