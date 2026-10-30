import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export const apiKeyAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("authorization");
  const strimHeader = c.req.header("x-strim-key");
  const rawKey = strimHeader || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);
  
  if (!rawKey || !rawKey.startsWith("strim_")) {
    await next();
    return;
  }

  const db = c.get("db");
  const project = await db.project.findUnique({ where: { ingestKey: rawKey } });
  
  if (!project) {
    return c.json({ error: "UNAUTHORIZED", message: "Invalid STRIM Project API key" }, 401);
  }

  c.set("projectId", project.id);
  c.set("organizationId", project.organizationId);
  c.set("ingestKey", project.ingestKey);
  await next();
});

