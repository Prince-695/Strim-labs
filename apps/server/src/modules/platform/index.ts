import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import {
  CuidSchema,
  UserSchema,
  UsageSchema,
  HealthLiveSchema,
  HealthReadySchema,
  DependenciesHealthSchema,
  ErrorResponseSchema,
} from "../../lib/schemas";

// ─── Health Routes ────────────────────────────────────────────────────────────

const healthLiveRoute = createRoute({
  method: "get",
  path: "/health/live",
  tags: ["Platform & Health"],
  summary: "Liveness probe verifying HTTP runtime responsiveness",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: HealthLiveSchema,
        },
      },
      description: "Service is live",
    },
  },
});

const healthReadyRoute = createRoute({
  method: "get",
  path: "/health/ready",
  tags: ["Platform & Health"],
  summary: "Readiness probe verifying database connectivity",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: HealthReadySchema,
        },
      },
      description: "Service is ready",
    },
    503: {
      content: {
        "application/json": {
          schema: HealthReadySchema,
        },
      },
      description: "Service degraded or database unreachable",
    },
  },
});

const healthDependenciesRoute = createRoute({
  method: "get",
  path: "/health/dependencies",
  tags: ["Platform & Health"],
  summary: "Check health and response latency of downstream dependencies",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DependenciesHealthSchema,
        },
      },
      description: "Dependency latency report",
    },
  },
});

// ─── Me & Usage Routes ────────────────────────────────────────────────────────

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Platform & Health"],
  summary: "Get current authenticated user profile",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UserSchema,
        },
      },
      description: "User profile",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
  },
});

const getUserUsageRoute = createRoute({
  method: "get",
  path: "/usage",
  tags: ["Platform & Health"],
  summary: "Get user account quotas and resource usage",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UsageSchema,
        },
      },
      description: "Account usage and limits",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
  },
});

const getOrgUsageRoute = createRoute({
  method: "get",
  path: "/organizations/:orgId/usage",
  tags: ["Platform & Health"],
  summary: "Get organization quotas, project counts and monthly ingestion usage",
  request: {
    params: z.object({ orgId: CuidSchema }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UsageSchema,
        },
      },
      description: "Organization quota usage",
    },
    401: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Unauthorized" },
    404: { content: { "application/json": { schema: ErrorResponseSchema } }, description: "Organization not found" },
  },
});

// ─── Module Router ────────────────────────────────────────────────────────────

export const platformRoutes = new OpenAPIHono<AppEnv>();

// Liveness probe
platformRoutes.openapi(healthLiveRoute, async (c) => {
  return c.json(
    {
      status: "ok" as const,
      version: "2.0.0",
      timestamp: new Date().toISOString(),
    },
    200
  );
});

// Readiness probe
platformRoutes.openapi(healthReadyRoute, async (c) => {
  const db = c.get("db");
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return c.json(
      {
        status: "ok" as const,
        database: "ok" as const,
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (err) {
    return c.json(
      {
        status: "degraded" as const,
        database: "error" as const,
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

// Dependencies health
platformRoutes.openapi(healthDependenciesRoute, async (c) => {
  const db = c.get("db");
  const start = Date.now();
  let dbStatus = "ok";
  let dbLatency = 0;

  try {
    await db.$queryRawUnsafe("SELECT 1");
    dbLatency = Date.now() - start;
  } catch {
    dbStatus = "error";
    dbLatency = Date.now() - start;
  }

  return c.json(
    {
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
      },
    },
    200
  );
});

// Authenticated platform endpoints
platformRoutes.use("/me", requireAuth);
platformRoutes.use("/usage", requireAuth);
platformRoutes.use("/organizations/:orgId/usage", requireAuth);

// Get current user profile
platformRoutes.openapi(getMeRoute, async (c) => {
  const userId = c.get("userId")!;
  const db = c.get("db");

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return c.json({ code: "NOT_FOUND", message: "User not found" }, 401);
  }

  return c.json(
    {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      timezone: user.timezone,
      locale: user.locale,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    200
  );
});

// Get user account usage
platformRoutes.openapi(getUserUsageRoute, async (c) => {
  const userId = c.get("userId")!;
  const db = c.get("db");

  const [memberships, projectsCount] = await Promise.all([
    db.membership.count({ where: { userId } }),
    db.project.count({
      where: {
        organization: {
          memberships: {
            some: { userId },
          },
        },
      },
    }),
  ]);

  const now = new Date();
  const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return c.json(
    {
      plan: "DEVELOPER",
      organizations: { used: memberships, limit: 3 },
      projects: { used: projectsCount, limit: 15 },
      ingestEventsPerMonth: { used: 12500, limit: 1000000 },
      loadTestMinutesPerMonth: { used: 15, limit: 120 },
      apiKeysPerOrg: { used: 2, limit: 10 },
      retentionDays: 30,
      resetAt,
    },
    200
  );
});

// Get organization usage
platformRoutes.openapi(getOrgUsageRoute, async (c) => {
  const userId = c.get("userId")!;
  const { orgId } = c.req.valid("param");
  const db = c.get("db");

  const org = await db.organization.findFirst({
    where: {
      id: orgId,
      memberships: {
        some: { userId },
      },
    },
    include: {
      projects: { select: { id: true } },
      apiKeys: { select: { id: true } },
    },
  });

  if (!org) {
    return c.json({ code: "NOT_FOUND", message: "Organization not found" }, 404);
  }

  const projectCount = org.projects.length;
  const apiKeyCount = org.apiKeys.length;

  const now = new Date();
  const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return c.json(
    {
      plan: org.plan,
      organizations: { used: 1, limit: 3 },
      projects: { used: projectCount, limit: 5 },
      ingestEventsPerMonth: { used: 45000, limit: 5000000 },
      loadTestMinutesPerMonth: { used: 35, limit: 300 },
      apiKeysPerOrg: { used: apiKeyCount, limit: 10 },
      retentionDays: org.plan === "ENTERPRISE" ? 90 : 30,
      resetAt,
    },
    200
  );
});
