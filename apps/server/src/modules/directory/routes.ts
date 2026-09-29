import { createRoute, z } from "@hono/zod-openapi";
import {
  AcceptInviteSchema,
  AddTeamMemberSchema,
  ApplicationIdParamSchema,
  ApplicationResponseSchema,
  ContextHierarchyResponseSchema,
  CreateApplicationSchema,
  CreateEnvironmentSchema,
  CreateInviteSchema,
  CreateProjectSchema,
  CreateTeamSchema,
  CreateWorkspaceSchema,
  EnvironmentResponseSchema,
  ErrorResponseSchema,
  IdParamSchema,
  OrganizationResponseSchema,
  ProjectIdParamSchema,
  ProjectResponseSchema,
  SuccessResponseSchema,
  TeamMemberParamSchema,
  UpdateApplicationSchema,
  UpdateEnvironmentSchema,
  UpdateMembershipSchema,
  UpdateOrganizationSchema,
  UpdateProjectSchema,
  UpdateWorkspaceSchema,
  WorkspaceIdParamSchema,
  WorkspaceResponseSchema,
} from "./schemas";

const tags = ["Directory & Tenancy"];

// --- Organization ---
export const getOrganizationRoute = createRoute({
  method: "get",
  path: "/",
  tags,
  summary: "Get current organization details",
  description: "Returns organization metadata, billing account, and resource counts.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Organization details", content: { "application/json": { schema: OrganizationResponseSchema } } },
    404: { description: "Organization not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updateOrganizationRoute = createRoute({
  method: "patch",
  path: "/",
  tags,
  summary: "Update current organization (Admin)",
  description: "Updates organization name or slug.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: {
    body: { content: { "application/json": { schema: UpdateOrganizationSchema } } },
  },
  responses: {
    200: { description: "Organization updated", content: { "application/json": { schema: OrganizationResponseSchema } } },
  },
});

// --- Context Hierarchy ---
export const getContextHierarchyRoute = createRoute({
  method: "get",
  path: "/context",
  tags,
  summary: "Get full organization context tree",
  description: "Returns full nested hierarchy: Workspaces -> Projects -> Applications -> Environments for global switcher.",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Context tree", content: { "application/json": { schema: ContextHierarchyResponseSchema } } },
  },
});

// --- Workspaces ---
export const listWorkspacesRoute = createRoute({
  method: "get",
  path: "/workspaces",
  tags,
  summary: "List workspaces",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Workspaces list", content: { "application/json": { schema: z.object({ workspaces: z.array(WorkspaceResponseSchema) }) } } },
  },
});

export const getWorkspaceRoute = createRoute({
  method: "get",
  path: "/workspaces/:id",
  tags,
  summary: "Get workspace by ID",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Workspace details", content: { "application/json": { schema: WorkspaceResponseSchema } } },
    404: { description: "Workspace not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createWorkspaceRoute = createRoute({
  method: "post",
  path: "/workspaces",
  tags,
  summary: "Create workspace (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { body: { content: { "application/json": { schema: CreateWorkspaceSchema } } } },
  responses: {
    201: { description: "Workspace created", content: { "application/json": { schema: WorkspaceResponseSchema } } },
  },
});

export const updateWorkspaceRoute = createRoute({
  method: "patch",
  path: "/workspaces/:id",
  tags,
  summary: "Update workspace (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: UpdateWorkspaceSchema } } } },
  responses: {
    200: { description: "Workspace updated", content: { "application/json": { schema: WorkspaceResponseSchema } } },
    404: { description: "Workspace not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deleteWorkspaceRoute = createRoute({
  method: "delete",
  path: "/workspaces/:id",
  tags,
  summary: "Delete workspace (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Workspace deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Workspace not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// --- Projects ---
export const listProjectsRoute = createRoute({
  method: "get",
  path: "/workspaces/:workspaceId/projects",
  tags,
  summary: "List projects in workspace",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: WorkspaceIdParamSchema },
  responses: {
    200: { description: "Projects list", content: { "application/json": { schema: z.object({ projects: z.array(ProjectResponseSchema) }) } } },
  },
});

export const getProjectRoute = createRoute({
  method: "get",
  path: "/projects/:id",
  tags,
  summary: "Get project by ID",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Project details", content: { "application/json": { schema: ProjectResponseSchema } } },
    404: { description: "Project not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createProjectRoute = createRoute({
  method: "post",
  path: "/workspaces/:workspaceId/projects",
  tags,
  summary: "Create project in workspace (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: WorkspaceIdParamSchema, body: { content: { "application/json": { schema: CreateProjectSchema } } } },
  responses: {
    201: { description: "Project created", content: { "application/json": { schema: ProjectResponseSchema } } },
    404: { description: "Workspace not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updateProjectRoute = createRoute({
  method: "patch",
  path: "/projects/:id",
  tags,
  summary: "Update project (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: UpdateProjectSchema } } } },
  responses: {
    200: { description: "Project updated", content: { "application/json": { schema: ProjectResponseSchema } } },
    404: { description: "Project not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deleteProjectRoute = createRoute({
  method: "delete",
  path: "/projects/:id",
  tags,
  summary: "Delete project (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Project deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Project not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// --- Applications ---
export const listApplicationsRoute = createRoute({
  method: "get",
  path: "/projects/:projectId/applications",
  tags,
  summary: "List applications in project",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: ProjectIdParamSchema },
  responses: {
    200: { description: "Applications list", content: { "application/json": { schema: z.object({ applications: z.array(ApplicationResponseSchema) }) } } },
  },
});

export const getApplicationRoute = createRoute({
  method: "get",
  path: "/applications/:id",
  tags,
  summary: "Get application by ID",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Application details", content: { "application/json": { schema: ApplicationResponseSchema } } },
    404: { description: "Application not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createApplicationRoute = createRoute({
  method: "post",
  path: "/projects/:projectId/applications",
  tags,
  summary: "Create application in project (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: ProjectIdParamSchema, body: { content: { "application/json": { schema: CreateApplicationSchema } } } },
  responses: {
    201: { description: "Application created", content: { "application/json": { schema: ApplicationResponseSchema } } },
    404: { description: "Project not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updateApplicationRoute = createRoute({
  method: "patch",
  path: "/applications/:id",
  tags,
  summary: "Update application (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: UpdateApplicationSchema } } } },
  responses: {
    200: { description: "Application updated", content: { "application/json": { schema: ApplicationResponseSchema } } },
    404: { description: "Application not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deleteApplicationRoute = createRoute({
  method: "delete",
  path: "/applications/:id",
  tags,
  summary: "Delete application (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Application deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Application not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// --- Environments ---
export const listEnvironmentsRoute = createRoute({
  method: "get",
  path: "/applications/:applicationId/environments",
  tags,
  summary: "List environments for application",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: ApplicationIdParamSchema },
  responses: {
    200: { description: "Environments list", content: { "application/json": { schema: z.object({ environments: z.array(EnvironmentResponseSchema) }) } } },
  },
});

export const getEnvironmentRoute = createRoute({
  method: "get",
  path: "/environments/:id",
  tags,
  summary: "Get environment by ID",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Environment details", content: { "application/json": { schema: EnvironmentResponseSchema } } },
    404: { description: "Environment not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const createEnvironmentRoute = createRoute({
  method: "post",
  path: "/applications/:applicationId/environments",
  tags,
  summary: "Create environment (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: ApplicationIdParamSchema, body: { content: { "application/json": { schema: CreateEnvironmentSchema } } } },
  responses: {
    201: { description: "Environment created", content: { "application/json": { schema: EnvironmentResponseSchema } } },
    404: { description: "Application not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const updateEnvironmentRoute = createRoute({
  method: "patch",
  path: "/environments/:id",
  tags,
  summary: "Update environment (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: UpdateEnvironmentSchema } } } },
  responses: {
    200: { description: "Environment updated", content: { "application/json": { schema: EnvironmentResponseSchema } } },
    404: { description: "Environment not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deleteEnvironmentRoute = createRoute({
  method: "delete",
  path: "/environments/:id",
  tags,
  summary: "Delete environment (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Environment deleted", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Environment not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// --- Teams ---
export const listTeamsRoute = createRoute({
  method: "get",
  path: "/teams",
  tags,
  summary: "List teams",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Teams list", content: { "application/json": { schema: z.object({ teams: z.array(z.any()) }) } } },
  },
});

export const createTeamRoute = createRoute({
  method: "post",
  path: "/teams",
  tags,
  summary: "Create team (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { body: { content: { "application/json": { schema: CreateTeamSchema } } } },
  responses: {
    201: { description: "Team created", content: { "application/json": { schema: z.any() } } },
  },
});

export const addTeamMemberRoute = createRoute({
  method: "post",
  path: "/teams/:id/members",
  tags,
  summary: "Add member to team (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: AddTeamMemberSchema } } } },
  responses: {
    200: { description: "Team member added", content: { "application/json": { schema: z.any() } } },
    404: { description: "Team not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const removeTeamMemberRoute = createRoute({
  method: "delete",
  path: "/teams/:id/members/:userId",
  tags,
  summary: "Remove member from team (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: TeamMemberParamSchema },
  responses: {
    200: { description: "Member removed from team", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Team not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

// --- Members & Invites ---
export const listMembersRoute = createRoute({
  method: "get",
  path: "/members",
  tags,
  summary: "List organization members",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Members list", content: { "application/json": { schema: z.object({ members: z.array(z.any()) }) } } },
  },
});

export const updateMembershipRoute = createRoute({
  method: "patch",
  path: "/members/:id",
  tags,
  summary: "Update member role (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: UpdateMembershipSchema } } } },
  responses: {
    200: { description: "Member role updated", content: { "application/json": { schema: z.any() } } },
    404: { description: "Member not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const deleteMembershipRoute = createRoute({
  method: "delete",
  path: "/members/:id",
  tags,
  summary: "Remove member from organization (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Member removed", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Member not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const listInvitesRoute = createRoute({
  method: "get",
  path: "/invites",
  tags,
  summary: "List pending organization invites",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  responses: {
    200: { description: "Invites list", content: { "application/json": { schema: z.object({ invites: z.array(z.any()) }) } } },
  },
});

export const createInviteRoute = createRoute({
  method: "post",
  path: "/invites",
  tags,
  summary: "Invite user to organization (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { body: { content: { "application/json": { schema: CreateInviteSchema } } } },
  responses: {
    201: { description: "Invite created with invitation token", content: { "application/json": { schema: z.any() } } },
  },
});

export const revokeInviteRoute = createRoute({
  method: "delete",
  path: "/invites/:id",
  tags,
  summary: "Revoke invite (Admin)",
  security: [{ bearerAuth: [] }, { organizationHeader: [] }],
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Invite revoked", content: { "application/json": { schema: SuccessResponseSchema } } },
    404: { description: "Invite not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

export const acceptInviteRoute = createRoute({
  method: "post",
  path: "/invites/accept",
  tags,
  summary: "Accept organization invite",
  description: "Validates invite token and adds authenticated user to organization.",
  security: [{ bearerAuth: [] }],
  request: { body: { content: { "application/json": { schema: AcceptInviteSchema } } } },
  responses: {
    200: { description: "Invite accepted", content: { "application/json": { schema: z.any() } } },
    400: { description: "Invalid or expired token", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});
