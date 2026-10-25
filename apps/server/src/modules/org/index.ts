import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../../types";
import { requireOrg } from "../../middleware/tenant";
import { requireAuth } from "../../middleware/auth";
import { randomToken } from "../../lib/crypto";

const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
});

export const orgRoutes = new Hono<AppEnv>();

/**
 * List all organizations for the current authenticated user
 */
orgRoutes.get("/user-orgs", requireAuth, async (c) => {
  const userId = c.get("userId")!;
  const db = c.get("db");

  const memberships = await db.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: {
            select: { projects: true, memberships: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const orgs = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    projectCount: m.organization._count.projects,
    memberCount: m.organization._count.memberships,
  }));

  return c.json({ orgs, maxOrgs: 3 });
});

/**
 * Create a new organization (enforcing HARD LIMIT: max 3 per user)
 */
orgRoutes.post("/", requireAuth, zValidator("json", createOrgSchema), async (c) => {
  const userId = c.get("userId")!;
  const { name } = c.req.valid("json");
  const db = c.get("db");

  const currentCount = await db.membership.count({
    where: { userId },
  });

  if (currentCount >= 3) {
    return c.json(
      {
        error: "ORG_LIMIT_EXCEEDED",
        message: "Maximum limit of 3 organizations per user reached.",
      },
      400
    );
  }

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `org-${randomToken(4)}`;

  const org = await db.organization.create({
    data: {
      name,
      slug: `${slug}-${randomToken(3)}`,
      memberships: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  return c.json(
    {
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: "OWNER",
      },
    },
    201
  );
});

/**
 * Get current organization details and members
 */
orgRoutes.get("/", requireOrg, async (c) => {
  const organizationId = c.get("organizationId")!;
  const db = c.get("db");

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      projects: {
        select: {
          id: true,
          name: true,
          baseUrl: true,
          targetUrl: true,
          status: true,
          apiKey: true,
          apiKeyPrefix: true,
          createdAt: true,
          _count: {
            select: { discoveredRoutes: true, testRuns: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: { projects: true, testRuns: true, memberships: true },
      },
    },
  });

  if (!org) {
    return c.json({ error: "NOT_FOUND", message: "Organization not found" }, 404);
  }

  return c.json({
    org,
    limits: {
      maxOrgs: 3,
      maxProjects: 5,
    },
  });
});
