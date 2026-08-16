import { createMiddleware } from "hono/factory";
import { sha256 } from "../lib/crypto";
import type { AppEnv } from "../types";

export const apiKeyAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer sk_")) {
    await next();
    return;
  }
  const raw = header.slice(7);
  const db = c.get("db");
  const key = await db.apiKey.findUnique({ where: { keyHash: sha256(raw) } });
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
    return c.json({ error: "UNAUTHORIZED", message: "Invalid API key" }, 401);
  }
  c.set("apiKeyId", key.id);
  c.set("apiKeyScopes", key.scopes);
  c.set("organizationId", key.organizationId);
  await next();
});

export function requireScope(scope: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const scopes = c.get("apiKeyScopes") ?? [];
    if (!c.get("apiKeyId")) {
      await next();
      return;
    }
    if (!scopes.includes(scope)) {
      return c.json({ error: "FORBIDDEN", message: `API key missing scope ${scope}` }, 403);
    }
    await next();
  });
}
