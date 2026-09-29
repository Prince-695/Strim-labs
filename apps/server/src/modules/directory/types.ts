import type { MembershipScope, Role } from "@strim/shared";
import type { EnvironmentType } from "@prisma/client";

export type OrganizationUpdateInput = {
  name?: string;
  slug?: string;
};

export type WorkspaceCreateInput = {
  name: string;
  slug: string;
};

export type WorkspaceUpdateInput = {
  name?: string;
  slug?: string;
};

export type ProjectCreateInput = {
  name: string;
  slug: string;
};

export type ProjectUpdateInput = {
  name?: string;
  slug?: string;
};

export type ApplicationCreateInput = {
  name: string;
  repository?: string;
  language?: string;
  framework?: string;
  region?: string;
  version?: string;
  ownerTeamId: string;
  technicalOwnerId: string;
  oncallTeamId: string;
};

export type ApplicationUpdateInput = {
  name?: string;
  repository?: string;
  language?: string;
  framework?: string;
  region?: string;
  version?: string;
  ownerTeamId?: string;
  technicalOwnerId?: string;
  oncallTeamId?: string;
};

export type EnvironmentCreateInput = {
  name: string;
  type: EnvironmentType;
  region?: string;
  declaredState?: Record<string, unknown>;
};

export type EnvironmentUpdateInput = {
  name?: string;
  region?: string;
  declaredState?: Record<string, unknown>;
};

export type TeamCreateInput = {
  name: string;
};

export type InviteCreateInput = {
  email: string;
  role?: Role;
  scope?: MembershipScope;
};
