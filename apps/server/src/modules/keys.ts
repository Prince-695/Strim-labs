import { Hono } from "hono";
import { z } from "zod";
import { API_KEY_SCOPES } from "@strim/shared";
import type { AppEnv } from "../types";
import { randomToken, sha256 } from "../lib/crypto";
import { writeAudit } from "../lib/audit";
import { requireAuth } from "../middleware/auth";
import { requireOrg } from "../middleware/tenant";
import { requireRole } from "../middleware/rbac";

export const keyRoutes = new Hono<AppEnv>();
keyRoutes.use("*", requireAuth, requireOrg, requireRole("ADMIN"));

keyRoutes.get("/", async (c) => {
  const keys = await c.get("db").apiKey.findMany({
    where: { organizationId: c.get("organizationId")! },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
  return c.json({ keys });
});

keyRoutes.post("/", async (c) => {
  const body = z
    .object({
      name: z.string(),
      scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
      expiresAt: z.string().datetime().optional(),
    })
    .parse(await c.req.json());
  if (body.scopes.includes("telemetry:write") && body.scopes.includes("config:write")) {
    return c.json(
      {
        error: "VALIDATION",
        message: "Do not combine telemetry:write with administrative write scopes on one key",
      },
      400,
    );
  }
  const raw = `sk_${randomToken()}`;
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const key = await db.apiKey.create({
    data: {
      organizationId,
      name: body.name,
      prefix: raw.slice(0, 10),
      keyHash: sha256(raw),
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      createdById: c.get("userId"),
    },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "api_key.create",
    resourceType: "api_key",
    resourceId: key.id,
    newValue: { name: key.name, scopes: key.scopes },
  });
  return c.json({ ...key, secret: raw }, 201);
});

keyRoutes.post("/:id/revoke", async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const existing = await db.apiKey.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);
  const key = await db.apiKey.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "api_key.revoke",
    resourceType: "api_key",
    resourceId: key.id,
  });
  return c.json(key);
});

keyRoutes.post("/:id/rotate", async (c) => {
  const db = c.get("db");
  const organizationId = c.get("organizationId")!;
  const existing = await db.apiKey.findFirst({ where: { id: c.req.param("id"), organizationId } });
  if (!existing) return c.json({ error: "NOT_FOUND" }, 404);
  const raw = `sk_${randomToken()}`;
  const key = await db.apiKey.update({
    where: { id: existing.id },
    data: { prefix: raw.slice(0, 10), keyHash: sha256(raw), revokedAt: null },
  });
  await writeAudit(db, {
    organizationId,
    actorId: c.get("userId"),
    action: "api_key.rotate",
    resourceType: "api_key",
    resourceId: key.id,
  });
  return c.json({ ...key, secret: raw });
});
