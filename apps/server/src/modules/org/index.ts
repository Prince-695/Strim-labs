import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types";
import { requireOrg } from "../../middleware/tenant";
import { randomToken, sha256 } from "../../lib/crypto";

const createApiKeySchema = z.object({
  name: z.string().min(2),
});

export const orgRoutes = new Hono<AppEnv>();

orgRoutes.use("*", requireOrg);

orgRoutes.get("/", async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      apiKeys: {
        select: { id: true, name: true, prefix: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { projects: true, testRuns: true },
      },
    },
  });

  if (!org) {
    return c.json({ error: "NOT_FOUND", message: "Organization not found" }, 404);
  }

  return c.json({ org });
});

orgRoutes.post("/api-keys", zValidator("json", createApiKeySchema), async (c) => {
  const organizationId = c.get("organizationId")!;
  const { name } = c.req.valid("json");
  const db = c.get("db");

  const secretPart = randomToken(24);
  const prefix = `strim_${secretPart.slice(0, 6)}`;
  const fullKey = `${prefix}_${secretPart}`;
  const keyHash = sha256(fullKey);

  const apiKey = await db.apiKey.create({
    data: {
      organizationId,
      name,
      prefix,
      keyHash,
    },
  });

  return c.json({
    apiKey: { id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, createdAt: apiKey.createdAt },
    rawKey: fullKey,
  }, 201);
});

orgRoutes.delete("/api-keys/:id", async (c) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const db = c.get("db");

  const apiKey = await db.apiKey.findFirst({ where: { id, organizationId } });
  if (!apiKey) {
    return c.json({ error: "NOT_FOUND", message: "API key not found" }, 404);
  }

  await db.apiKey.delete({ where: { id } });
  return c.json({ success: true });
});
