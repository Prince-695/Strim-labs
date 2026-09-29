import type { AppDb } from "../../lib/prisma";
import { writeAudit } from "../../lib/audit";
import { randomToken, sha256 } from "../../lib/crypto";
import type {
  ApplicationCreateInput,
  ApplicationUpdateInput,
  EnvironmentCreateInput,
  EnvironmentUpdateInput,
  InviteCreateInput,
  OrganizationUpdateInput,
  ProjectCreateInput,
  ProjectUpdateInput,
  TeamCreateInput,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from "./types";

export class DirectoryService {
  // --- Organization ---
  static async getOrganization(db: AppDb, organizationId: string) {
    return db.organization.findUnique({
      where: { id: organizationId },
      include: {
        billingAccount: true,
        _count: {
          select: {
            memberships: true,
            workspaces: true,
            projects: true,
            applications: true,
          },
        },
      },
    });
  }

  static async updateOrganization(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    input: OrganizationUpdateInput,
  ) {
    const updated = await db.organization.update({
      where: { id: organizationId },
      data: input,
    });

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "organization.update",
      resourceType: "organization",
      resourceId: organizationId,
      newValue: input,
    });

    return updated;
  }

  // --- Context Hierarchy ---
  static async getContextHierarchy(db: AppDb, organizationId: string) {
    return db.workspace.findMany({
      where: { organizationId },
      include: { projects: { include: { applications: { include: { environments: true } } } } },
    });
  }

  // --- Workspaces ---
  static async listWorkspaces(db: AppDb, organizationId: string) {
    return db.workspace.findMany({
      where: { organizationId },
      include: { _count: { select: { projects: true } } },
    });
  }

  static async getWorkspace(db: AppDb, organizationId: string, id: string) {
    return db.workspace.findFirst({
      where: { id, organizationId },
      include: { projects: { include: { applications: true } } },
    });
  }

  static async createWorkspace(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    input: WorkspaceCreateInput,
  ) {
    const ws = await db.workspace.create({ data: { ...input, organizationId } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "workspace.create",
      resourceType: "workspace",
      resourceId: ws.id,
      newValue: input,
    });
    return ws;
  }

  static async updateWorkspace(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    id: string,
    input: WorkspaceUpdateInput,
  ) {
    const existing = await db.workspace.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    const ws = await db.workspace.update({ where: { id }, data: input });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "workspace.update",
      resourceType: "workspace",
      resourceId: ws.id,
      newValue: input,
    });
    return ws;
  }

  static async deleteWorkspace(db: AppDb, organizationId: string, userId: string | undefined, id: string) {
    const existing = await db.workspace.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    await db.workspace.delete({ where: { id } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "workspace.delete",
      resourceType: "workspace",
      resourceId: id,
    });
    return true;
  }

  // --- Projects ---
  static async listProjects(db: AppDb, organizationId: string, workspaceId: string) {
    return db.project.findMany({
      where: { organizationId, workspaceId },
      include: { _count: { select: { applications: true } } },
    });
  }

  static async getProject(db: AppDb, organizationId: string, id: string) {
    return db.project.findFirst({
      where: { id, organizationId },
      include: { applications: { include: { environments: true } } },
    });
  }

  static async createProject(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    workspaceId: string,
    input: ProjectCreateInput,
  ) {
    const ws = await db.workspace.findFirst({ where: { id: workspaceId, organizationId } });
    if (!ws) return null;

    const project = await db.project.create({
      data: { ...input, workspaceId, organizationId },
    });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "project.create",
      resourceType: "project",
      resourceId: project.id,
      newValue: input,
    });
    return project;
  }

  static async updateProject(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    id: string,
    input: ProjectUpdateInput,
  ) {
    const existing = await db.project.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    const project = await db.project.update({ where: { id }, data: input });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "project.update",
      resourceType: "project",
      resourceId: project.id,
      newValue: input,
    });
    return project;
  }

  static async deleteProject(db: AppDb, organizationId: string, userId: string | undefined, id: string) {
    const existing = await db.project.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    await db.project.delete({ where: { id } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "project.delete",
      resourceType: "project",
      resourceId: id,
    });
    return true;
  }

  // --- Applications ---
  static async listApplications(db: AppDb, organizationId: string, projectId: string) {
    return db.application.findMany({
      where: { organizationId, projectId },
      include: { environments: true, ownerTeam: true, technicalOwner: true, oncallTeam: true },
    });
  }

  static async getApplication(db: AppDb, organizationId: string, id: string) {
    return db.application.findFirst({
      where: { id, organizationId },
      include: {
        environments: true,
        ownerTeam: { include: { members: { include: { user: true } } } },
        technicalOwner: true,
        oncallTeam: true,
        project: true,
      },
    });
  }

  static async createApplication(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    projectId: string,
    input: ApplicationCreateInput,
  ) {
    const project = await db.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) return null;

    const app = await db.application.create({
      data: { ...input, projectId, organizationId },
    });

    // Auto-create default environments
    for (const [name, type] of [
      ["Development", "DEVELOPMENT"],
      ["Staging", "STAGING"],
      ["Production", "PRODUCTION"],
    ] as const) {
      await db.environment.create({
        data: {
          organizationId,
          applicationId: app.id,
          name,
          type,
          region: app.region,
        },
      });
    }

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "application.create",
      resourceType: "application",
      resourceId: app.id,
      newValue: input,
    });

    return app;
  }

  static async updateApplication(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    id: string,
    input: ApplicationUpdateInput,
  ) {
    const existing = await db.application.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    const app = await db.application.update({ where: { id }, data: input });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "application.update",
      resourceType: "application",
      resourceId: app.id,
      newValue: input,
    });
    return app;
  }

  static async deleteApplication(db: AppDb, organizationId: string, userId: string | undefined, id: string) {
    const existing = await db.application.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    await db.application.delete({ where: { id } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "application.delete",
      resourceType: "application",
      resourceId: id,
    });
    return true;
  }

  // --- Environments ---
  static async listEnvironments(db: AppDb, organizationId: string, applicationId: string) {
    return db.environment.findMany({
      where: { organizationId, applicationId },
      orderBy: { name: "asc" },
    });
  }

  static async getEnvironment(db: AppDb, organizationId: string, id: string) {
    return db.environment.findFirst({
      where: { id, organizationId },
      include: {
        application: true,
        runtimeVersions: { take: 5, orderBy: { seq: "desc" } },
        _count: { select: { requestRecords: true, changePlans: true, incidents: true } },
      },
    });
  }

  static async createEnvironment(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    applicationId: string,
    input: EnvironmentCreateInput,
  ) {
    const app = await db.application.findFirst({ where: { id: applicationId, organizationId } });
    if (!app) return null;

    const env = await db.environment.create({
      data: {
        ...input,
        declaredState: (input.declaredState ?? {}) as object,
        applicationId,
        organizationId,
      },
    });

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "environment.create",
      resourceType: "environment",
      resourceId: env.id,
      newValue: input,
    });

    return env;
  }

  static async updateEnvironment(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    id: string,
    input: EnvironmentUpdateInput,
  ) {
    const existing = await db.environment.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    const env = await db.environment.update({
      where: { id },
      data: {
        name: input.name,
        region: input.region,
        declaredState: input.declaredState ? (input.declaredState as object) : undefined,
      },
    });

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "environment.update",
      resourceType: "environment",
      resourceId: env.id,
      newValue: input,
    });

    return env;
  }

  static async deleteEnvironment(db: AppDb, organizationId: string, userId: string | undefined, id: string) {
    const existing = await db.environment.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    await db.environment.delete({ where: { id } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "environment.delete",
      resourceType: "environment",
      resourceId: id,
    });
    return true;
  }

  // --- Teams ---
  static async listTeams(db: AppDb, organizationId: string) {
    return db.team.findMany({
      where: { organizationId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { ownedApps: true, oncallApps: true } },
      },
    });
  }

  static async createTeam(db: AppDb, organizationId: string, userId: string | undefined, input: TeamCreateInput) {
    const team = await db.team.create({ data: { ...input, organizationId } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "team.create",
      resourceType: "team",
      resourceId: team.id,
      newValue: input,
    });
    return team;
  }

  static async addTeamMember(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    teamId: string,
    targetUserId: string,
  ) {
    const team = await db.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) return null;

    const member = await db.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      create: { teamId, userId: targetUserId },
      update: {},
    });

    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "team.member_add",
      resourceType: "team",
      resourceId: teamId,
      newValue: { userId: targetUserId },
    });

    return member;
  }

  static async removeTeamMember(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    teamId: string,
    targetUserId: string,
  ) {
    const team = await db.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) return null;

    await db.teamMember.deleteMany({ where: { teamId, userId: targetUserId } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "team.member_remove",
      resourceType: "team",
      resourceId: teamId,
      newValue: { userId: targetUserId },
    });

    return true;
  }

  // --- Memberships & Invites ---
  static async listMembers(db: AppDb, organizationId: string) {
    return db.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
  }

  static async updateMembership(
    db: AppDb,
    organizationId: string,
    userId: string | undefined,
    id: string,
    role: any,
  ) {
    const existing = await db.membership.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    const member = await db.membership.update({ where: { id }, data: { role } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "membership.update_role",
      resourceType: "membership",
      resourceId: id,
      newValue: { role },
    });

    return member;
  }

  static async deleteMembership(db: AppDb, organizationId: string, userId: string | undefined, id: string) {
    const existing = await db.membership.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    await db.membership.delete({ where: { id } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "membership.remove",
      resourceType: "membership",
      resourceId: id,
    });

    return true;
  }

  static async createInvite(
    db: AppDb,
    organizationId: string,
    invitedById: string,
    input: InviteCreateInput,
  ) {
    const rawToken = randomToken(32);
    const invite = await db.organizationInvite.create({
      data: {
        organizationId,
        email: input.email.toLowerCase(),
        role: input.role ?? "ENGINEER",
        scope: input.scope ?? "ORGANIZATION",
        tokenHash: sha256(rawToken),
        invitedById,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
      },
    });

    await writeAudit(db, {
      organizationId,
      actorId: invitedById,
      action: "invite.create",
      resourceType: "organization_invite",
      resourceId: invite.id,
      newValue: { email: invite.email, role: invite.role },
    });

    return { ...invite, token: rawToken };
  }

  static async listInvites(db: AppDb, organizationId: string) {
    return db.organizationInvite.findMany({
      where: { organizationId },
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  static async revokeInvite(db: AppDb, organizationId: string, userId: string | undefined, id: string) {
    const existing = await db.organizationInvite.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    await db.organizationInvite.delete({ where: { id } });
    await writeAudit(db, {
      organizationId,
      actorId: userId,
      action: "invite.revoke",
      resourceType: "organization_invite",
      resourceId: id,
    });

    return true;
  }

  static async acceptInvite(db: AppDb, userId: string, rawToken: string) {
    const tokenHash = sha256(rawToken);
    const invite = await db.organizationInvite.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (!invite || invite.expiresAt < new Date()) {
      return { ok: false, error: "INVALID_TOKEN", message: "Invitation is invalid or expired" };
    }

    const existingMembership = await db.membership.findFirst({
      where: { organizationId: invite.organizationId, userId },
    });

    if (existingMembership) {
      await db.organizationInvite.delete({ where: { id: invite.id } });
      return { ok: true, organization: invite.organization };
    }

    await db.membership.create({
      data: {
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
        scope: invite.scope,
      },
    });

    await db.organizationInvite.delete({ where: { id: invite.id } });

    await writeAudit(db, {
      organizationId: invite.organizationId,
      actorId: userId,
      action: "invite.accept",
      resourceType: "membership",
      newValue: { role: invite.role, email: invite.email },
    });

    return { ok: true, organization: invite.organization };
  }
}
