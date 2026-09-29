import { z } from "@hono/zod-openapi";
import { ROLES, MEMBERSHIP_SCOPES } from "@strim/shared";

export const RoleEnumSchema = z.enum(ROLES).openapi("Role");
export const MembershipScopeEnumSchema = z.enum(MEMBERSHIP_SCOPES).openapi("MembershipScope");
export const EnvironmentTypeEnumSchema = z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION", "CUSTOM"]).openapi("EnvironmentType");

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().optional().openapi({ example: "Resource not found" }),
  })
  .openapi("DirectoryErrorResponse");

export const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().optional().openapi({ example: "Operation successful" }),
  })
  .openapi("DirectorySuccessResponse");

export const IdParamSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_res_123" }),
  })
  .openapi("IdParam");

export const WorkspaceIdParamSchema = z
  .object({
    workspaceId: z.string().openapi({ example: "cuid_ws_123" }),
  })
  .openapi("WorkspaceIdParam");

export const ProjectIdParamSchema = z
  .object({
    projectId: z.string().openapi({ example: "cuid_proj_123" }),
  })
  .openapi("ProjectIdParam");

export const ApplicationIdParamSchema = z
  .object({
    applicationId: z.string().openapi({ example: "cuid_app_123" }),
  })
  .openapi("ApplicationIdParam");

export const TeamMemberParamSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_team_123" }),
    userId: z.string().openapi({ example: "cuid_user_456" }),
  })
  .openapi("TeamMemberParam");

// --- Organization Schemas ---
export const UpdateOrganizationSchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: "Acme Enterprise" }),
    slug: z.string().min(1).optional().openapi({ example: "acme-enterprise" }),
  })
  .openapi("UpdateOrganizationRequest");

export const OrganizationResponseSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_org_123" }),
    name: z.string().openapi({ example: "Acme Corp" }),
    slug: z.string().openapi({ example: "acme" }),
    createdAt: z.string().openapi({ example: "2026-09-29T10:00:00.000Z" }),
  })
  .openapi("OrganizationResponse");

// --- Context Schemas ---
export const ContextHierarchyResponseSchema = z
  .object({
    workspaces: z.array(z.any()),
  })
  .openapi("ContextHierarchyResponse");

// --- Workspace Schemas ---
export const CreateWorkspaceSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Payments" }),
    slug: z.string().min(1).openapi({ example: "payments" }),
  })
  .openapi("CreateWorkspaceRequest");

export const UpdateWorkspaceSchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: "Payments v2" }),
    slug: z.string().min(1).optional().openapi({ example: "payments-v2" }),
  })
  .openapi("UpdateWorkspaceRequest");

export const WorkspaceResponseSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_ws_123" }),
    organizationId: z.string().openapi({ example: "cuid_org_123" }),
    name: z.string().openapi({ example: "Payments" }),
    slug: z.string().openapi({ example: "payments" }),
  })
  .openapi("WorkspaceResponse");

// --- Project Schemas ---
export const CreateProjectSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Checkout Service" }),
    slug: z.string().min(1).openapi({ example: "checkout-service" }),
  })
  .openapi("CreateProjectRequest");

export const UpdateProjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
  })
  .openapi("UpdateProjectRequest");

export const ProjectResponseSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_proj_123" }),
    workspaceId: z.string().openapi({ example: "cuid_ws_123" }),
    name: z.string().openapi({ example: "Checkout Service" }),
    slug: z.string().openapi({ example: "checkout-service" }),
  })
  .openapi("ProjectResponse");

// --- Application Schemas ---
export const CreateApplicationSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Checkout API" }),
    repository: z.string().optional().openapi({ example: "github.com/acme/checkout" }),
    language: z.string().optional().openapi({ example: "TypeScript" }),
    framework: z.string().optional().openapi({ example: "Hono" }),
    region: z.string().optional().openapi({ example: "us-east-1" }),
    version: z.string().optional().openapi({ example: "1.0.0" }),
    ownerTeamId: z.string().min(1).openapi({ example: "cuid_team_platform" }),
    technicalOwnerId: z.string().min(1).openapi({ example: "cuid_user_priya" }),
    oncallTeamId: z.string().min(1).openapi({ example: "cuid_team_sre" }),
  })
  .openapi("CreateApplicationRequest");

export const UpdateApplicationSchema = z
  .object({
    name: z.string().min(1).optional(),
    repository: z.string().optional(),
    language: z.string().optional(),
    framework: z.string().optional(),
    region: z.string().optional(),
    version: z.string().optional(),
    ownerTeamId: z.string().optional(),
    technicalOwnerId: z.string().optional(),
    oncallTeamId: z.string().optional(),
  })
  .openapi("UpdateApplicationRequest");

export const ApplicationResponseSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_app_123" }),
    projectId: z.string().openapi({ example: "cuid_proj_123" }),
    name: z.string().openapi({ example: "Checkout API" }),
    repository: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    framework: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    version: z.string().nullable().optional(),
    ownerTeamId: z.string().openapi({ example: "cuid_team_platform" }),
    technicalOwnerId: z.string().openapi({ example: "cuid_user_priya" }),
    oncallTeamId: z.string().openapi({ example: "cuid_team_sre" }),
  })
  .openapi("ApplicationResponse");

// --- Environment Schemas ---
export const CreateEnvironmentSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "Production" }),
    type: EnvironmentTypeEnumSchema,
    region: z.string().optional().openapi({ example: "us-east-1" }),
    declaredState: z.record(z.unknown()).optional().openapi({
      example: { "cache.enabled": true, "checkout.timeout": 3000 },
    }),
  })
  .openapi("CreateEnvironmentRequest");

export const UpdateEnvironmentSchema = z
  .object({
    name: z.string().min(1).optional(),
    region: z.string().optional(),
    declaredState: z.record(z.unknown()).optional(),
  })
  .openapi("UpdateEnvironmentRequest");

export const EnvironmentResponseSchema = z
  .object({
    id: z.string().openapi({ example: "cuid_env_123" }),
    applicationId: z.string().openapi({ example: "cuid_app_123" }),
    name: z.string().openapi({ example: "Production" }),
    type: z.string().openapi({ example: "PRODUCTION" }),
    region: z.string().nullable().optional(),
    declaredState: z.unknown().optional(),
  })
  .openapi("EnvironmentResponse");

// --- Team Schemas ---
export const CreateTeamSchema = z
  .object({
    name: z.string().min(1).openapi({ example: "SRE Team" }),
  })
  .openapi("CreateTeamRequest");

export const AddTeamMemberSchema = z
  .object({
    userId: z.string().min(1).openapi({ example: "cuid_user_123" }),
  })
  .openapi("AddTeamMemberRequest");

// --- Member & Invite Schemas ---
export const UpdateMembershipSchema = z
  .object({
    role: RoleEnumSchema,
  })
  .openapi("UpdateMembershipRequest");

export const CreateInviteSchema = z
  .object({
    email: z.string().email().openapi({ example: "new-engineer@acme.test" }),
    role: RoleEnumSchema.optional(),
    scope: MembershipScopeEnumSchema.optional(),
  })
  .openapi("CreateInviteRequest");

export const AcceptInviteSchema = z
  .object({
    token: z.string().min(1).openapi({ example: "invitation_token_string" }),
  })
  .openapi("AcceptInviteRequest");
