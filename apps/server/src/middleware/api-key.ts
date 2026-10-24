import { createMiddleware } from "hono/factory";
import { sha256 } from "../lib/crypto";
import type { AppEnv } from "../types";

export const apiKeyAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("authorization");
  const rawKey = header?.startsWith("Bearer ") ? header.slice(7) : null;
  
  if (!rawKey || !rawKey.startsWith("strim_")) {
    await next();
    return;
  }

  const db = c.get("db");
  const key = await db.apiKey.findUnique({ where: { keyHash: sha256(rawKey) } });
  
  if (!key) {
    return c.json({ error: "UNAUTHORIZED", message: "Invalid API key" }, 401);
  }

  c.set("apiKeyId", key.id);
  c.set("organizationId", key.organizationId);
  await next();
});
