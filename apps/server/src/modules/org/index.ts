import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { roleAtLeast, type Role } from "@strim/shared";
import type { AppEnv } from "../../types";
import {
  CreateOrgSchema,
  UpdateOrgSchema,
  OrgSchema,
  MemberSchema,
  InvitationSchema,
  CreateInvitationSchema,
  AcceptInvitationSchema,
  UpdateMemberSchema,
  TransferOwnershipSchema,
  ApiErrorSchema,
} from "../../lib/schemas";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import { randomToken, sha256 } from "../../lib/crypto";

export const orgsRoutes = new OpenAPIHono<AppEnv>();
orgsRoutes.use("*", requireAuth);
orgsRoutes.use("/:orgId", requireOrg);
orgsRoutes.use("/:orgId/*", requireOrg);

function checkRole(c: Context<AppEnv>, min: Role) {
  const role = c.get("role");
  if (!role || !roleAtLeast(role, min)) {
    return c.json({ code: "FORBIDDEN", message: `Requires ${min} role or higher`, requestId: c.get("requestId") }, 403);
  }
  return null;
}

// ─── POST /organizations ──────────────────────────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: ["Organizations"],
    summary: "Create organization",
    description: "Create a new organization. **Maximum 3 organizations per user.**",
    security: [{ BearerAuth: [] }],
    request: { body: { content: { "application/json": { schema: CreateOrgSchema } }, required: true } },
    responses: {
      201: { description: "Organization created", content: { "application/json": { schema: z.object({ organization: OrgSchema }) } } },
      400: { description: "Organization limit reached (max 3)", content: { "application/json": { schema: ApiErrorSchema } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const userId = c.get("userId")!;
    const { name, description, website } = c.req.valid("json");
    const db = c.get("db");
    const reqId = c.get("requestId");

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return c.json({ code: "UNAUTHORIZED", message: "User not found. Please sign in again.", requestId: reqId }, 401);
    }

    const count = await db.membership.count({ where: { userId } });
    if (count >= 3) {
      return c.json({ code: "ORG_LIMIT_EXCEEDED", message: "Maximum of 3 organizations per user", requestId: reqId }, 400);
    }

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "org";
    const slug = `${baseSlug}-${randomToken(3)}`;

    const org = await db.organization.create({
      data: {
        name,
        description,
        website,
        slug,
        memberships: { create: { userId, role: "OWNER" } },
      },
      include: { _count: { select: { memberships: true, projects: true } } },
    });

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        avatarUrl: null,
        website: org.website,
        plan: org.plan,
        memberCount: org._count.memberships,
        projectCount: org._count.projects,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      },
    }, 201);
  },
);

// ─── GET /organizations ───────────────────────────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Organizations"],
    summary: "List organizations",
    description: "List all organizations the authenticated user belongs to.",
    security: [{ BearerAuth: [] }],
    responses: {
      200: { description: "User organizations", content: { "application/json": { schema: z.object({ organizations: z.array(OrgSchema) }) } } },
    },
  }),
  async (c) => {
    const userId = c.get("userId")!;
    const db = c.get("db");

    const memberships = await db.membership.findMany({
      where: { userId },
      include: { organization: { include: { _count: { select: { memberships: true, projects: true } } } } },
      orderBy: { createdAt: "asc" },
    });

    return c.json({
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        description: m.organization.description,
        avatarUrl: null,
        website: m.organization.website,
        plan: m.organization.plan,
        memberCount: m.organization._count.memberships,
        projectCount: m.organization._count.projects,
        createdAt: m.organization.createdAt.toISOString(),
        updatedAt: m.organization.updatedAt.toISOString(),
      })),
    }, 200);
  },
);

// ─── GET /organizations/:orgId ────────────────────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{orgId}",
    tags: ["Organizations"],
    summary: "Get organization",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ orgId: z.string() }) },
    responses: {
      200: { description: "Organization detail", content: { "application/json": { schema: z.object({ organization: OrgSchema }) } } },
      403: { description: "Not a member", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const org = await db.organization.findUnique({
      where: { id: c.get("organizationId")! },
      include: { _count: { select: { memberships: true, projects: true } } },
    });
    if (!org) return c.json({ code: "NOT_FOUND", message: "Organization not found" }, 404);
    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        avatarUrl: null,
        website: org.website,
        plan: org.plan,
        memberCount: org._count.memberships,
        projectCount: org._count.projects,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── PATCH /organizations/:orgId ──────────────────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{orgId}",
    tags: ["Organizations"],
    summary: "Update organization",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ orgId: z.string() }),
      body: { content: { "application/json": { schema: UpdateOrgSchema } } },
    },
    responses: {
      200: { description: "Organization updated", content: { "application/json": { schema: z.object({ organization: OrgSchema }) } } },
      403: { description: "Requires ADMIN or OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ADMIN");
    if (roleErr) return roleErr;

    const body = c.req.valid("json");
    const db = c.get("db");
    const org = await db.organization.update({
      where: { id: c.get("organizationId")! },
      data: body,
      include: { _count: { select: { memberships: true, projects: true } } },
    });
    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        avatarUrl: null,
        website: org.website,
        plan: org.plan,
        memberCount: org._count.memberships,
        projectCount: org._count.projects,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      },
    }, 200);
  },
);

// ─── DELETE /organizations/:orgId ─────────────────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{orgId}",
    tags: ["Organizations"],
    summary: "Delete organization",
    description: "Permanently delete an organization and all its projects, services, metrics, and data.",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ orgId: z.string() }) },
    responses: {
      200: { description: "Organization deleted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "OWNER");
    if (roleErr) return roleErr;

    const orgId = c.get("organizationId")!;
    const db = c.get("db");
    await db.organization.delete({ where: { id: orgId } });
    return c.json({ ok: true }, 200);
  },
);

// ─── GET /organizations/:orgId/members ────────────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{orgId}/members",
    tags: ["Organizations"],
    summary: "List members",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ orgId: z.string() }) },
    responses: {
      200: { description: "Organization members", content: { "application/json": { schema: z.object({ members: z.array(MemberSchema) }) } } },
    },
  }),
  async (c) => {
    const orgId = c.get("organizationId")!;
    const db = c.get("db");
    const members = await db.membership.findMany({
      where: { organizationId: orgId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return c.json({
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.createdAt.toISOString(),
      })),
    }, 200);
  },
);

// ─── PATCH /organizations/:orgId/members/:userId ──────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/{orgId}/members/{userId}",
    tags: ["Organizations"],
    summary: "Update member role",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ orgId: z.string(), userId: z.string() }),
      body: { content: { "application/json": { schema: UpdateMemberSchema } } },
    },
    responses: {
      200: { description: "Role updated", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      400: { description: "Cannot change own role or demote owner", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "Requires ADMIN or OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ADMIN");
    if (roleErr) return roleErr;

    const { userId: targetUserId } = c.req.valid("param");
    const { role } = c.req.valid("json");
    const currentUserId = c.get("userId")!;
    const orgId = c.get("organizationId")!;
    const db = c.get("db");

    if (targetUserId === currentUserId) {
      return c.json({ code: "BAD_REQUEST", message: "Cannot change your own role", requestId: c.get("requestId") }, 400);
    }

    await db.membership.update({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
      data: { role },
    });

    return c.json({ ok: true }, 200);
  },
);

// ─── DELETE /organizations/:orgId/members/:userId ─────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{orgId}/members/{userId}",
    tags: ["Organizations"],
    summary: "Remove member",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ orgId: z.string(), userId: z.string() }) },
    responses: {
      200: { description: "Member removed", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      400: { description: "Cannot remove owner", content: { "application/json": { schema: ApiErrorSchema } } },
      403: { description: "Requires ADMIN or OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ADMIN");
    if (roleErr) return roleErr;

    const { userId: targetUserId } = c.req.valid("param");
    const orgId = c.get("organizationId")!;
    const db = c.get("db");

    const target = await db.membership.findFirst({ where: { organizationId: orgId, userId: targetUserId } });
    if (target?.role === "OWNER") {
      return c.json({ code: "FORBIDDEN", message: "Cannot remove the organization owner", requestId: c.get("requestId") }, 400);
    }

    await db.membership.delete({
      where: { organizationId_userId: { organizationId: orgId, userId: targetUserId } },
    });

    return c.json({ ok: true }, 200);
  },
);

// ─── POST /organizations/:orgId/invitations ───────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{orgId}/invitations",
    tags: ["Organizations"],
    summary: "Invite member",
    description: "Send an email invitation to join the organization.",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ orgId: z.string() }),
      body: { content: { "application/json": { schema: CreateInvitationSchema } }, required: true },
    },
    responses: {
      201: { description: "Invitation sent", content: { "application/json": { schema: z.object({ invitation: InvitationSchema }) } } },
      403: { description: "Requires ADMIN or OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
      409: { description: "User already a member or invited", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ADMIN");
    if (roleErr) return roleErr;

    const orgId = c.get("organizationId")!;
    const inviterId = c.get("userId")!;
    const { email, role } = c.req.valid("json");
    const db = c.get("db");
    const reqId = c.get("requestId");

    const existingMember = await db.membership.findFirst({
      where: { organizationId: orgId, user: { email: email.toLowerCase() } },
    });
    if (existingMember) {
      return c.json({ code: "ALREADY_MEMBER", message: "User is already a member", requestId: reqId }, 409);
    }

    const token = randomToken(32);
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const inv = await db.invitation.create({
      data: {
        organizationId: orgId,
        email: email.toLowerCase(),
        role,
        tokenHash,
        expiresAt,
        invitedById: inviterId,
      },
    });

    console.log(`[DEV] Invite token for ${email} to org ${orgId}: ${token}`);

    return c.json({
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      },
    }, 201);
  },
);

// ─── GET /organizations/:orgId/invitations ────────────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/{orgId}/invitations",
    tags: ["Organizations"],
    summary: "List invitations",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ orgId: z.string() }) },
    responses: {
      200: { description: "Pending invitations", content: { "application/json": { schema: z.object({ invitations: z.array(InvitationSchema) }) } } },
      403: { description: "Requires ADMIN or OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ADMIN");
    if (roleErr) return roleErr;

    const orgId = c.get("organizationId")!;
    const db = c.get("db");
    const list = await db.invitation.findMany({
      where: { organizationId: orgId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    return c.json({
      invitations: list.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      })),
    }, 200);
  },
);

// ─── POST /organizations/:orgId/invitations/:invitationId/resend ──────────────

orgsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{orgId}/invitations/{invitationId}/resend",
    tags: ["Organizations"],
    summary: "Resend invitation",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ orgId: z.string(), invitationId: z.string() }) },
    responses: {
      200: { description: "Invitation resent", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires ADMIN or OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Invitation not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ADMIN");
    if (roleErr) return roleErr;

    const { invitationId } = c.req.valid("param");
    const orgId = c.get("organizationId")!;
    const db = c.get("db");

    const inv = await db.invitation.findFirst({ where: { id: invitationId, organizationId: orgId } });
    if (!inv) return c.json({ code: "NOT_FOUND", message: "Invitation not found" }, 404);

    const token = randomToken(32);
    await db.invitation.update({
      where: { id: invitationId },
      data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
    });

    console.log(`[DEV] Resent invite token for ${inv.email}: ${token}`);
    return c.json({ ok: true }, 200);
  },
);

// ─── DELETE /organizations/:orgId/invitations/:invitationId ───────────────────

orgsRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/{orgId}/invitations/{invitationId}",
    tags: ["Organizations"],
    summary: "Cancel invitation",
    security: [{ BearerAuth: [] }],
    request: { params: z.object({ orgId: z.string(), invitationId: z.string() }) },
    responses: {
      200: { description: "Invitation cancelled", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires ADMIN or OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
      404: { description: "Invitation not found", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "ADMIN");
    if (roleErr) return roleErr;

    const { invitationId } = c.req.valid("param");
    const orgId = c.get("organizationId")!;
    const db = c.get("db");

    const inv = await db.invitation.findFirst({ where: { id: invitationId, organizationId: orgId } });
    if (!inv) return c.json({ code: "NOT_FOUND", message: "Invitation not found" }, 404);

    await db.invitation.update({ where: { id: invitationId }, data: { status: "CANCELLED" } });
    return c.json({ ok: true }, 200);
  },
);

// ─── POST /organizations/:orgId/invitations/accept ────────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{orgId}/invitations/accept",
    tags: ["Organizations"],
    summary: "Accept invitation",
    description: "Accept an organization invitation using the token from the invitation email.",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ orgId: z.string() }),
      body: { content: { "application/json": { schema: AcceptInvitationSchema } } },
    },
    responses: {
      200: { description: "Invitation accepted", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      400: { description: "Invalid or expired token", content: { "application/json": { schema: ApiErrorSchema } } },
      409: { description: "Max organizations limit reached", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const userId = c.get("userId")!;
    const { token } = c.req.valid("json");
    const db = c.get("db");
    const reqId = c.get("requestId");

    const tokenHash = sha256(token);
    const inv = await db.invitation.findUnique({ where: { tokenHash } });

    if (!inv || inv.status !== "PENDING" || inv.expiresAt < new Date()) {
      return c.json({ code: "INVALID_TOKEN", message: "Invitation token is invalid or expired", requestId: reqId }, 400);
    }

    const orgCount = await db.membership.count({ where: { userId } });
    if (orgCount >= 3) {
      return c.json({ code: "ORG_LIMIT_EXCEEDED", message: "You have reached the maximum of 3 organizations", requestId: reqId }, 409);
    }

    await db.membership.create({ data: { organizationId: inv.organizationId, userId, role: inv.role } });
    await db.invitation.update({ where: { tokenHash }, data: { status: "ACCEPTED", acceptedAt: new Date() } });

    return c.json({ ok: true }, 200);
  },
);

// ─── POST /organizations/:orgId/transfer-ownership ───────────────────────────

orgsRoutes.openapi(
  createRoute({
    method: "post",
    path: "/{orgId}/transfer-ownership",
    tags: ["Organizations"],
    summary: "Transfer ownership",
    description: "Transfer the OWNER role to another member. Current owner is downgraded to ADMIN.",
    security: [{ BearerAuth: [] }],
    request: {
      params: z.object({ orgId: z.string() }),
      body: { content: { "application/json": { schema: TransferOwnershipSchema } } },
    },
    responses: {
      200: { description: "Ownership transferred", content: { "application/json": { schema: z.object({ ok: z.boolean() }) } } },
      403: { description: "Requires OWNER role", content: { "application/json": { schema: ApiErrorSchema } } },
    },
  }),
  async (c) => {
    const roleErr = checkRole(c, "OWNER");
    if (roleErr) return roleErr;

    const { newOwnerId } = c.req.valid("json");
    const orgId = c.get("organizationId")!;
    const currentUserId = c.get("userId")!;
    const db = c.get("db");

    const targetMember = await db.membership.findFirst({ where: { organizationId: orgId, userId: newOwnerId } });
    if (!targetMember) {
      return c.json({ code: "NOT_FOUND", message: "New owner is not a member of this organization" }, 404 as any);
    }

    await db.$transaction([
      db.membership.updateMany({ where: { organizationId: orgId, userId: currentUserId }, data: { role: "ADMIN" } }),
      db.membership.updateMany({ where: { organizationId: orgId, userId: newOwnerId }, data: { role: "OWNER" } }),
    ]);

    await db.auditLog.create({
      data: { organizationId: orgId, userId: currentUserId, action: "TRANSFER", resourceType: "Organization", resourceId: orgId, metadata: { newOwnerId } },
    });

    return c.json({ ok: true }, 200);
  },
);
