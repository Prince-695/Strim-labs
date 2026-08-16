import { createMiddleware } from "hono/factory";
import type { Role } from "@strim/shared";
import type { AppEnv } from "../types";

export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
  const orgId =
    c.req.header("x-organization-id") ??
    c.req.query("organizationId") ??
    c.req.param("organizationId");
  const userId = c.get("userId");
  if (!orgId) {
    return c.json({ error: "VALIDATION", message: "organizationId required" }, 400);
  }
  const db = c.get("db");
  const membership = userId
    ? await db.membership.findFirst({
        where: { organizationId: orgId, userId },
      })
    : null;
  if (!membership && !c.get("apiKeyId")) {
    return c.json({ error: "TENANT_MISMATCH", message: "No access to this organization" }, 403);
  }
  if (membership) c.set("role", membership.role as Role);
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
