import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../types";
import { requireAuth } from "../../middleware/auth";
import { requireOrg } from "../../middleware/tenant";
import {
  acceptInviteRoute,
  addTeamMemberRoute,
  createApplicationRoute,
  createEnvironmentRoute,
  createInviteRoute,
  createProjectRoute,
  createTeamRoute,
  createWorkspaceRoute,
  deleteApplicationRoute,
  deleteEnvironmentRoute,
  deleteMembershipRoute,
  deleteProjectRoute,
  deleteWorkspaceRoute,
  getApplicationRoute,
  getContextHierarchyRoute,
  getEnvironmentRoute,
  getOrganizationRoute,
  getProjectRoute,
  getWorkspaceRoute,
  listApplicationsRoute,
  listEnvironmentsRoute,
  listInvitesRoute,
  listMembersRoute,
  listProjectsRoute,
  listTeamsRoute,
  listWorkspacesRoute,
  removeTeamMemberRoute,
  revokeInviteRoute,
  updateApplicationRoute,
  updateEnvironmentRoute,
  updateMembershipRoute,
  updateOrganizationRoute,
  updateProjectRoute,
  updateWorkspaceRoute,
} from "./routes";
import {
  acceptInviteHandler,
  addTeamMemberHandler,
  createApplicationHandler,
  createEnvironmentHandler,
  createInviteHandler,
  createProjectHandler,
  createTeamHandler,
  createWorkspaceHandler,
  deleteApplicationHandler,
  deleteEnvironmentHandler,
  deleteMembershipHandler,
  deleteProjectHandler,
  deleteWorkspaceHandler,
  getApplicationHandler,
  getContextHierarchyHandler,
  getEnvironmentHandler,
  getOrganizationHandler,
  getProjectHandler,
  getWorkspaceHandler,
  listApplicationsHandler,
  listEnvironmentsHandler,
  listInvitesHandler,
  listMembersHandler,
  listProjectsHandler,
  listTeamsHandler,
  listWorkspacesHandler,
  removeTeamMemberHandler,
  revokeInviteHandler,
  updateApplicationHandler,
  updateEnvironmentHandler,
  updateMembershipHandler,
  updateOrganizationHandler,
  updateProjectHandler,
  updateWorkspaceHandler,
} from "./handlers";

export const directoryRoutes = new OpenAPIHono<AppEnv>();

// Public accept invite endpoint
directoryRoutes.openapi(acceptInviteRoute, acceptInviteHandler);

// Protected tenant-scoped endpoints
directoryRoutes.use("*", requireAuth, requireOrg);

// Organization & Context
directoryRoutes.openapi(getOrganizationRoute, getOrganizationHandler);
directoryRoutes.openapi(updateOrganizationRoute, updateOrganizationHandler);
directoryRoutes.openapi(getContextHierarchyRoute, getContextHierarchyHandler);

// Workspaces
directoryRoutes.openapi(listWorkspacesRoute, listWorkspacesHandler);
directoryRoutes.openapi(getWorkspaceRoute, getWorkspaceHandler);
directoryRoutes.openapi(createWorkspaceRoute, createWorkspaceHandler);
directoryRoutes.openapi(updateWorkspaceRoute, updateWorkspaceHandler);
directoryRoutes.openapi(deleteWorkspaceRoute, deleteWorkspaceHandler);

// Projects
directoryRoutes.openapi(listProjectsRoute, listProjectsHandler);
directoryRoutes.openapi(getProjectRoute, getProjectHandler);
directoryRoutes.openapi(createProjectRoute, createProjectHandler);
directoryRoutes.openapi(updateProjectRoute, updateProjectHandler);
directoryRoutes.openapi(deleteProjectRoute, deleteProjectHandler);

// Applications
directoryRoutes.openapi(listApplicationsRoute, listApplicationsHandler);
directoryRoutes.openapi(getApplicationRoute, getApplicationHandler);
directoryRoutes.openapi(createApplicationRoute, createApplicationHandler);
directoryRoutes.openapi(updateApplicationRoute, updateApplicationHandler);
directoryRoutes.openapi(deleteApplicationRoute, deleteApplicationHandler);

// Environments
directoryRoutes.openapi(listEnvironmentsRoute, listEnvironmentsHandler);
directoryRoutes.openapi(getEnvironmentRoute, getEnvironmentHandler);
directoryRoutes.openapi(createEnvironmentRoute, createEnvironmentHandler);
directoryRoutes.openapi(updateEnvironmentRoute, updateEnvironmentHandler);
directoryRoutes.openapi(deleteEnvironmentRoute, deleteEnvironmentHandler);

// Teams
directoryRoutes.openapi(listTeamsRoute, listTeamsHandler);
directoryRoutes.openapi(createTeamRoute, createTeamHandler);
directoryRoutes.openapi(addTeamMemberRoute, addTeamMemberHandler);
directoryRoutes.openapi(removeTeamMemberRoute, removeTeamMemberHandler);

// Members & Invites
directoryRoutes.openapi(listMembersRoute, listMembersHandler);
directoryRoutes.openapi(updateMembershipRoute, updateMembershipHandler);
directoryRoutes.openapi(deleteMembershipRoute, deleteMembershipHandler);
directoryRoutes.openapi(listInvitesRoute, listInvitesHandler);
directoryRoutes.openapi(createInviteRoute, createInviteHandler);
directoryRoutes.openapi(revokeInviteRoute, revokeInviteHandler);

export * from "./schemas";
export * from "./types";
export * from "./service";
