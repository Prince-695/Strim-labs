import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import crypto from "crypto";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { roleAtLeast, type Role } from "@strim/shared";
import {
  CuidSchema,
  CreateApiKeySchema,
  ApiKeySchema,
  CreatedApiKeySchema,
  CreateWebhookSchema,
  UpdateWebhookSchema,
  WebhookSchema,
  WebhookDeliverySchema,
  CreateIntegrationSchema,
  IntegrationSchema,
  AuditLogSchema,
  AuditLogQuerySchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
} from "../../lib/schemas";

function checkRole(c: any, minRole: Role) {
  const role = c.get("role") as Role | undefined;
  if (!role || !roleAtLeast(role, minRole)) {
    return c.json(
      {
        code: "FORBIDDEN",
        message: `Requires ${minRole} or higher role in this organization`,
      },
      403
    );
  }
  return null;
}

// ─── API Keys Routes ──────────────────────────────────────────────────────────

const createApiKeyRoute = createRoute({
  method: "post",
  path: "/api-keys",
  tags: ["Security & Organization"],
  summary: "Generate a new organization or service API key",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateApiKeySchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: CreatedApiKeySchema,
        },
      },
      description: "API key created. The raw key is returned ONCE.",
    },
    400: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Bad request" },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

const listApiKeysRoute = createRoute({
  method: "get",
  path: "/api-keys",
  tags: ["Security & Organization"],
  summary: "List API keys for the organization",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(ApiKeySchema),
        },
      },
      description: "List of API keys",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

const revokeApiKeyRoute = createRoute({
  method: "delete",
  path: "/api-keys/:keyId",
  tags: ["Security & Organization"],
  summary: "Revoke an API key",
  request: {
    params: z.object({ keyId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessResponseSchema,
        },
      },
      description: "API key revoked",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

// ─── Webhooks Routes ──────────────────────────────────────────────────────────

const createWebhookRoute = createRoute({
  method: "post",
  path: "/webhooks",
  tags: ["Security & Organization"],
  summary: "Create an outgoing event webhook",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateWebhookSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: WebhookSchema,
        },
      },
      description: "Webhook configured",
    },
    400: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Bad request" },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

const listWebhooksRoute = createRoute({
  method: "get",
  path: "/webhooks",
  tags: ["Security & Organization"],
  summary: "List configured webhooks",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(WebhookSchema),
        },
      },
      description: "List of webhooks",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

const updateWebhookRoute = createRoute({
  method: "patch",
  path: "/webhooks/:webhookId",
  tags: ["Security & Organization"],
  summary: "Update webhook configuration",
  request: {
    params: z.object({ webhookId: CuidSchema }),
    body: {
      content: {
        "application/json": {
          schema: UpdateWebhookSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: WebhookSchema,
        },
      },
      description: "Webhook updated",
    },
    400: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Bad request" },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const deleteWebhookRoute = createRoute({
  method: "delete",
  path: "/webhooks/:webhookId",
  tags: ["Security & Organization"],
  summary: "Delete a webhook",
  request: {
    params: z.object({ webhookId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessResponseSchema,
        },
      },
      description: "Webhook deleted",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const testWebhookRoute = createRoute({
  method: "post",
  path: "/webhooks/:webhookId/test",
  tags: ["Security & Organization"],
  summary: "Send a test ping event to webhook target",
  request: {
    params: z.object({ webhookId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: WebhookDeliverySchema,
        },
      },
      description: "Test delivery executed",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

const listDeliveriesRoute = createRoute({
  method: "get",
  path: "/webhooks/:webhookId/deliveries",
  tags: ["Security & Organization"],
  summary: "List webhook delivery attempts",
  request: {
    params: z.object({ webhookId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(WebhookDeliverySchema),
        },
      },
      description: "Delivery history",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

// ─── Integrations Routes ──────────────────────────────────────────────────────

const listIntegrationsRoute = createRoute({
  method: "get",
  path: "/integrations",
  tags: ["Security & Organization"],
  summary: "List active third-party integrations",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(IntegrationSchema),
        },
      },
      description: "List of integrations",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  path: "/integrations",
  tags: ["Security & Organization"],
  summary: "Configure or connect a third-party integration",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateIntegrationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: IntegrationSchema,
        },
      },
      description: "Integration connected",
    },
    400: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Bad request" },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  path: "/integrations/:integrationId",
  tags: ["Security & Organization"],
  summary: "Disconnect an integration",
  request: {
    params: z.object({ integrationId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SuccessResponseSchema,
        },
      },
      description: "Integration disconnected",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Not found" },
  },
});

// ─── Audit Logs Route ─────────────────────────────────────────────────────────

const getAuditLogsRoute = createRoute({
  method: "get",
  path: "/audit-logs",
  tags: ["Security & Organization"],
  summary: "Query organization audit logs with filtering",
  request: {
    query: AuditLogQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(AuditLogSchema),
            total: z.number(),
          }),
        },
      },
      description: "Audit trail events",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    403: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Forbidden" },
  },
});

// ─── Module Router ────────────────────────────────────────────────────────────

export const securityRoutes = new OpenAPIHono<AppEnv>();

securityRoutes.use("*", requireAuth, requireOrg);

// Create API Key
securityRoutes.openapi(createApiKeyRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const userId = c.get("userId")!;
  const body = c.req.valid("json");
  const db = c.get("db");

  const rawKey = `sk_live_${crypto.randomUUID().replace(/-/g, "")}`;
  const prefix = rawKey.slice(0, 12);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await db.apiKey.create({
    data: {
      organizationId,
      userId,
      name: body.name,
      type: "ORG_SERVICE",
      keyHash,
      prefix,
      scopes: body.scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });

  return c.json(
    {
      id: apiKey.id,
      name: apiKey.name,
      type: apiKey.type,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      lastUsedAt: apiKey.lastUsedAt ? apiKey.lastUsedAt.toISOString() : null,
      expiresAt: apiKey.expiresAt ? apiKey.expiresAt.toISOString() : null,
      revokedAt: apiKey.revokedAt ? apiKey.revokedAt.toISOString() : null,
      createdAt: apiKey.createdAt.toISOString(),
      key: rawKey,
    },
    201
  );
});

// List API Keys
securityRoutes.openapi(listApiKeysRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const keys = await db.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return c.json(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      type: k.type,
      prefix: k.prefix,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
      revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    })),
    200
  );
});

// Revoke API Key
securityRoutes.openapi(revokeApiKeyRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const { keyId } = c.req.valid("param");
  const db = c.get("db");

  const key = await db.apiKey.findFirst({
    where: { id: keyId, organizationId },
  });

  if (!key) {
    return c.json({ code: "NOT_FOUND", message: "API key not found" }, 404);
  }

  await db.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  return c.json({ success: true, message: "API key revoked" }, 200);
});

// Create Webhook
securityRoutes.openapi(createWebhookRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const body = c.req.valid("json");
  const db = c.get("db");

  const secret = crypto.randomBytes(32).toString("hex");

  const webhook = await db.webhook.create({
    data: {
      organizationId,
      name: body.name,
      url: body.url,
      secret,
      events: body.events,
      enabled: body.enabled,
    },
  });

  return c.json(
    {
      id: webhook.id,
      organizationId: webhook.organizationId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      enabled: webhook.enabled,
      createdAt: webhook.createdAt.toISOString(),
      updatedAt: webhook.updatedAt.toISOString(),
    },
    201
  );
});

// List Webhooks
securityRoutes.openapi(listWebhooksRoute, async (c) => {
  const roleError = checkRole(c, "ENGINEER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const hooks = await db.webhook.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return c.json(
    hooks.map((h) => ({
      id: h.id,
      organizationId: h.organizationId,
      name: h.name,
      url: h.url,
      events: h.events,
      enabled: h.enabled,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    })),
    200
  );
});

// Update Webhook
securityRoutes.openapi(updateWebhookRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const { webhookId } = c.req.valid("param");
  const body = c.req.valid("json");
  const db = c.get("db");

  const existing = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!existing) {
    return c.json({ code: "NOT_FOUND", message: "Webhook not found" }, 404);
  }

  const updated = await db.webhook.update({
    where: { id: webhookId },
    data: {
      name: body.name ?? undefined,
      url: body.url ?? undefined,
      events: body.events ?? undefined,
      enabled: body.enabled ?? undefined,
    },
  });

  return c.json(
    {
      id: updated.id,
      organizationId: updated.organizationId,
      name: updated.name,
      url: updated.url,
      events: updated.events,
      enabled: updated.enabled,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    200
  );
});

// Delete Webhook
securityRoutes.openapi(deleteWebhookRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const { webhookId } = c.req.valid("param");
  const db = c.get("db");

  const existing = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!existing) {
    return c.json({ code: "NOT_FOUND", message: "Webhook not found" }, 404);
  }

  await db.webhook.delete({ where: { id: webhookId } });

  return c.json({ success: true, message: "Webhook deleted" }, 200);
});

// Test Webhook
securityRoutes.openapi(testWebhookRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const { webhookId } = c.req.valid("param");
  const db = c.get("db");

  const webhook = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!webhook) {
    return c.json({ code: "NOT_FOUND", message: "Webhook not found" }, 404);
  }

  const start = Date.now();
  let statusCode: number | null = null;
  let success = false;
  let responseBody = "";

  const payload = {
    event: "PING",
    webhookId: webhook.id,
    organizationId,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "StrimLabs-Webhook/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    statusCode = res.status;
    success = res.ok;
    responseBody = (await res.text()).slice(0, 1000);
  } catch (err: any) {
    statusCode = 504;
    success = false;
    responseBody = err.message ?? "Connection timeout";
  }

  const duration = Date.now() - start;

  const delivery = await db.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      eventType: "INCIDENT_CREATED",
      payload,
      statusCode,
      responseBody,
      success,
      duration,
    },
  });

  return c.json(
    {
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventType: delivery.eventType,
      payload: delivery.payload as Record<string, any>,
      statusCode: delivery.statusCode,
      success: delivery.success,
      attemptedAt: delivery.attemptedAt.toISOString(),
      duration: delivery.duration,
    },
    200
  );
});

// List Webhook Deliveries
securityRoutes.openapi(listDeliveriesRoute, async (c) => {
  const roleError = checkRole(c, "ENGINEER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const { webhookId } = c.req.valid("param");
  const db = c.get("db");

  const webhook = await db.webhook.findFirst({
    where: { id: webhookId, organizationId },
  });

  if (!webhook) {
    return c.json({ code: "NOT_FOUND", message: "Webhook not found" }, 404);
  }

  const deliveries = await db.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { attemptedAt: "desc" },
    take: 50,
  });

  return c.json(
    deliveries.map((d) => ({
      id: d.id,
      webhookId: d.webhookId,
      eventType: d.eventType,
      payload: d.payload as Record<string, any>,
      statusCode: d.statusCode,
      success: d.success,
      attemptedAt: d.attemptedAt.toISOString(),
      duration: d.duration,
    })),
    200
  );
});

// List Integrations
securityRoutes.openapi(listIntegrationsRoute, async (c) => {
  const roleError = checkRole(c, "VIEWER");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const integrations = await db.integration.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return c.json(
    integrations.map((i) => ({
      id: i.id,
      organizationId: i.organizationId,
      type: i.type,
      name: i.name,
      enabled: i.enabled,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    })),
    200
  );
});

// Create Integration
securityRoutes.openapi(createIntegrationRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const body = c.req.valid("json");
  const db = c.get("db");

  const integration = await db.integration.upsert({
    where: {
      organizationId_type: {
        organizationId,
        type: body.type,
      },
    },
    create: {
      organizationId,
      type: body.type,
      name: body.name,
      config: body.config,
      enabled: true,
    },
    update: {
      name: body.name,
      config: body.config,
      enabled: true,
    },
  });

  return c.json(
    {
      id: integration.id,
      organizationId: integration.organizationId,
      type: integration.type,
      name: integration.name,
      enabled: integration.enabled,
      createdAt: integration.createdAt.toISOString(),
      updatedAt: integration.updatedAt.toISOString(),
    },
    201
  );
});

// Delete Integration
securityRoutes.openapi(deleteIntegrationRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const { integrationId } = c.req.valid("param");
  const db = c.get("db");

  const existing = await db.integration.findFirst({
    where: { id: integrationId, organizationId },
  });

  if (!existing) {
    return c.json({ code: "NOT_FOUND", message: "Integration not found" }, 404);
  }

  await db.integration.delete({ where: { id: integrationId } });

  return c.json({ success: true, message: "Integration disconnected" }, 200);
});

// Get Audit Logs
securityRoutes.openapi(getAuditLogsRoute, async (c) => {
  const roleError = checkRole(c, "ADMIN");
  if (roleError) return roleError;

  const organizationId = c.get("organizationId")!;
  const { page, limit, action, userId, resourceType, from, to } = c.req.valid("query");
  const db = c.get("db");

  const where: any = {
    organizationId,
    ...(action ? { action: action as any } : {}),
    ...(userId ? { userId } : {}),
    ...(resourceType ? { resourceType } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.auditLog.count({ where }),
  ]);

  return c.json(
    {
      logs: logs.map((l) => ({
        id: l.id,
        organizationId: l.organizationId,
        userId: l.userId,
        userName: l.user?.name ?? null,
        action: l.action,
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        metadata: (l.metadata as Record<string, any>) ?? null,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
    },
    200
  );
});
