import type { Context } from "hono";
import type { AppEnv } from "../../types";
import { DirectoryService } from "./service";
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

// --- Organization ---
export const getOrganizationHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const org = await DirectoryService.getOrganization(c.get("db"), organizationId);
  if (!org) return c.json({ error: "NOT_FOUND", message: "Organization not found" }, 404);
  return c.json(org, 200);
};

export const updateOrganizationHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const body = (await c.req.json()) as OrganizationUpdateInput;
  const updated = await DirectoryService.updateOrganization(c.get("db"), organizationId, c.get("userId"), body);
  return c.json(updated, 200);
};

// --- Context Hierarchy ---
export const getContextHierarchyHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const workspaces = await DirectoryService.getContextHierarchy(c.get("db"), organizationId);
  return c.json({ workspaces }, 200);
};

// --- Workspaces ---
export const listWorkspacesHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const workspaces = await DirectoryService.listWorkspaces(c.get("db"), organizationId);
  return c.json({ workspaces: workspaces as any }, 200);
};

export const getWorkspaceHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const ws = await DirectoryService.getWorkspace(c.get("db"), organizationId, id);
  if (!ws) return c.json({ error: "NOT_FOUND", message: "Workspace not found" }, 404);
  return c.json(ws as any, 200);
};

export const createWorkspaceHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const body = (await c.req.json()) as WorkspaceCreateInput;
  const ws = await DirectoryService.createWorkspace(c.get("db"), organizationId, c.get("userId"), body);
  return c.json(ws as any, 201);
};

export const updateWorkspaceHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const body = (await c.req.json()) as WorkspaceUpdateInput;
  const ws = await DirectoryService.updateWorkspace(c.get("db"), organizationId, c.get("userId"), id, body);
  if (!ws) return c.json({ error: "NOT_FOUND", message: "Workspace not found" }, 404);
  return c.json(ws as any, 200);
};

export const deleteWorkspaceHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const deleted = await DirectoryService.deleteWorkspace(c.get("db"), organizationId, c.get("userId"), id);
  if (!deleted) return c.json({ error: "NOT_FOUND", message: "Workspace not found" }, 404);
  return c.json({ success: true, message: "Workspace deleted" }, 200);
};

// --- Projects ---
export const listProjectsHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const workspaceId = c.req.param("workspaceId");
  const projects = await DirectoryService.listProjects(c.get("db"), organizationId, workspaceId);
  return c.json({ projects: projects as any }, 200);
};

export const getProjectHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const project = await DirectoryService.getProject(c.get("db"), organizationId, id);
  if (!project) return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  return c.json(project as any, 200);
};

export const createProjectHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const workspaceId = c.req.param("workspaceId");
  const body = (await c.req.json()) as ProjectCreateInput;
  const project = await DirectoryService.createProject(c.get("db"), organizationId, c.get("userId"), workspaceId, body);
  if (!project) return c.json({ error: "NOT_FOUND", message: "Workspace not found" }, 404);
  return c.json(project as any, 201);
};

export const updateProjectHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const body = (await c.req.json()) as ProjectUpdateInput;
  const project = await DirectoryService.updateProject(c.get("db"), organizationId, c.get("userId"), id, body);
  if (!project) return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  return c.json(project as any, 200);
};

export const deleteProjectHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const deleted = await DirectoryService.deleteProject(c.get("db"), organizationId, c.get("userId"), id);
  if (!deleted) return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  return c.json({ success: true, message: "Project deleted" }, 200);
};

// --- Applications ---
export const listApplicationsHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId");
  const applications = await DirectoryService.listApplications(c.get("db"), organizationId, projectId);
  return c.json({ applications: applications as any }, 200);
};

export const getApplicationHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const app = await DirectoryService.getApplication(c.get("db"), organizationId, id);
  if (!app) return c.json({ error: "NOT_FOUND", message: "Application not found" }, 404);
  return c.json(app as any, 200);
};

export const createApplicationHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const projectId = c.req.param("projectId");
  const body = (await c.req.json()) as ApplicationCreateInput;
  const app = await DirectoryService.createApplication(c.get("db"), organizationId, c.get("userId"), projectId, body);
  if (!app) return c.json({ error: "NOT_FOUND", message: "Project not found" }, 404);
  return c.json(app as any, 201);
};

export const updateApplicationHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const body = (await c.req.json()) as ApplicationUpdateInput;
  const app = await DirectoryService.updateApplication(c.get("db"), organizationId, c.get("userId"), id, body);
  if (!app) return c.json({ error: "NOT_FOUND", message: "Application not found" }, 404);
  return c.json(app as any, 200);
};

export const deleteApplicationHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const deleted = await DirectoryService.deleteApplication(c.get("db"), organizationId, c.get("userId"), id);
  if (!deleted) return c.json({ error: "NOT_FOUND", message: "Application not found" }, 404);
  return c.json({ success: true, message: "Application deleted" }, 200);
};

// --- Environments ---
export const listEnvironmentsHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const applicationId = c.req.param("applicationId");
  const environments = await DirectoryService.listEnvironments(c.get("db"), organizationId, applicationId);
  return c.json({ environments: environments as any }, 200);
};

export const getEnvironmentHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const env = await DirectoryService.getEnvironment(c.get("db"), organizationId, id);
  if (!env) return c.json({ error: "NOT_FOUND", message: "Environment not found" }, 404);
  return c.json(env as any, 200);
};

export const createEnvironmentHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const applicationId = c.req.param("applicationId");
  const body = (await c.req.json()) as EnvironmentCreateInput;
  const env = await DirectoryService.createEnvironment(c.get("db"), organizationId, c.get("userId"), applicationId, body);
  if (!env) return c.json({ error: "NOT_FOUND", message: "Application not found" }, 404);
  return c.json(env as any, 201);
};

export const updateEnvironmentHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const body = (await c.req.json()) as EnvironmentUpdateInput;
  const env = await DirectoryService.updateEnvironment(c.get("db"), organizationId, c.get("userId"), id, body);
  if (!env) return c.json({ error: "NOT_FOUND", message: "Environment not found" }, 404);
  return c.json(env as any, 200);
};

export const deleteEnvironmentHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const deleted = await DirectoryService.deleteEnvironment(c.get("db"), organizationId, c.get("userId"), id);
  if (!deleted) return c.json({ error: "NOT_FOUND", message: "Environment not found" }, 404);
  return c.json({ success: true, message: "Environment deleted" }, 200);
};

// --- Teams ---
export const listTeamsHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const teams = await DirectoryService.listTeams(c.get("db"), organizationId);
  return c.json({ teams: teams as any }, 200);
};

export const createTeamHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const body = (await c.req.json()) as TeamCreateInput;
  const team = await DirectoryService.createTeam(c.get("db"), organizationId, c.get("userId"), body);
  return c.json(team as any, 201);
};

export const addTeamMemberHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const body = (await c.req.json()) as { userId: string };
  const member = await DirectoryService.addTeamMember(c.get("db"), organizationId, c.get("userId"), id, body.userId);
  if (!member) return c.json({ error: "NOT_FOUND", message: "Team not found" }, 404);
  return c.json(member as any, 200);
};

export const removeTeamMemberHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const userId = c.req.param("userId");
  const removed = await DirectoryService.removeTeamMember(c.get("db"), organizationId, c.get("userId"), id, userId);
  if (!removed) return c.json({ error: "NOT_FOUND", message: "Team not found" }, 404);
  return c.json({ success: true, message: "Team member removed" }, 200);
};

// --- Memberships & Invites ---
export const listMembersHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const members = await DirectoryService.listMembers(c.get("db"), organizationId);
  return c.json({ members: members as any }, 200);
};

export const updateMembershipHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const body = (await c.req.json()) as { role: any };
  const member = await DirectoryService.updateMembership(c.get("db"), organizationId, c.get("userId"), id, body.role);
  if (!member) return c.json({ error: "NOT_FOUND", message: "Member not found" }, 404);
  return c.json(member as any, 200);
};

export const deleteMembershipHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const deleted = await DirectoryService.deleteMembership(c.get("db"), organizationId, c.get("userId"), id);
  if (!deleted) return c.json({ error: "NOT_FOUND", message: "Member not found" }, 404);
  return c.json({ success: true, message: "Member removed" }, 200);
};

export const listInvitesHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const invites = await DirectoryService.listInvites(c.get("db"), organizationId);
  return c.json({ invites: invites as any }, 200);
};

export const createInviteHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const userId = c.get("userId")!;
  const body = (await c.req.json()) as InviteCreateInput;
  const invite = await DirectoryService.createInvite(c.get("db"), organizationId, userId, body);
  return c.json(invite as any, 201);
};

export const revokeInviteHandler = async (c: Context<AppEnv>) => {
  const organizationId = c.get("organizationId")!;
  const id = c.req.param("id");
  const revoked = await DirectoryService.revokeInvite(c.get("db"), organizationId, c.get("userId"), id);
  if (!revoked) return c.json({ error: "NOT_FOUND", message: "Invite not found" }, 404);
  return c.json({ success: true, message: "Invite revoked" }, 200);
};

export const acceptInviteHandler = async (c: Context<AppEnv>) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "UNAUTHORIZED", message: "Please log in or sign up first" }, 401);
  const { token } = (await c.req.json()) as { token: string };
  const result = await DirectoryService.acceptInvite(c.get("db"), userId, token);
  if (!result.ok) return c.json({ error: result.error ?? "INVALID_TOKEN", message: result.message }, 400);
  return c.json({ success: true, organization: result.organization as any }, 200);
};
