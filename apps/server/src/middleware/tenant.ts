import { createMiddleware } from "hono/factory";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../types";

/**
 * Resolves and verifies organization membership for the authenticated user.
 * Reads orgId from: x-organization-id header → query param → path param
 * Caches membership lookups for 60 seconds.
 */
const membershipCache = new Map<string, { role: Role; expiresAt: number }>();

export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
  const orgId =
    c.req.header("x-organization-id") ??
    c.req.query("organizationId") ??
    c.req.param("orgId");

  if (!orgId) {
    return c.json(
      { code: "VALIDATION_ERROR", message: "organizationId is required (x-organization-id header)", requestId: c.get("requestId") },
      400,
    );
  }

  const userId = c.get("userId");
  const ingestKey = c.get("ingestKey");

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

    if (!membership) {
      return c.json(
        { code: "FORBIDDEN", message: "You are not a member of this organization", requestId: c.get("requestId") },
        403,
      );
    }

    const role = membership.role as Role;
    membershipCache.set(cacheKey, { role, expiresAt: Date.now() + 60_000 });
    c.set("role", role);
  } else if (!ingestKey) {
    return c.json(
      { code: "UNAUTHORIZED", message: "Authentication required", requestId: c.get("requestId") },
      401,
    );
  }

  c.set("organizationId", orgId);
  await next();
});

/**
 * Validate and enforce the ingest API key from x-strim-key header.
 * Sets projectId, organizationId, and ingestKey context variables.
 */
export const requireIngestKey = createMiddleware<AppEnv>(async (c, next) => {
  const key =
    c.req.header("x-strim-key") ||
    (c.req.header("authorization")?.startsWith("Bearer ") ? c.req.header("authorization")!.slice(7) : null);

  if (!key || !key.startsWith("strim_")) {
    return c.json(
      { code: "UNAUTHORIZED", message: "Missing or invalid x-strim-key header", requestId: c.get("requestId") },
      401,
    );
  }

  const db = c.get("db");
  const project = await db.project.findUnique({
    where: { ingestKey: key },
    select: { id: true, organizationId: true, status: true },
  });

  if (!project) {
    return c.json(
      { code: "UNAUTHORIZED", message: "No project found matching this ingest key", requestId: c.get("requestId") },
      401,
    );
  }

  c.set("projectId", project.id);
  c.set("organizationId", project.organizationId);
  c.set("ingestKey", key);
  await next();
});

/** Verify resource's organization matches the request organization (cross-tenant protection) */
export function assertOrgMatch(resourceOrgId: string, requestOrgId: string, requestId?: string): never | void {
  if (resourceOrgId !== requestOrgId) {
    const err = Object.assign(new Error("TENANT_MISMATCH"), { status: 403 });
    throw err;
  }
}
