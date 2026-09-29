import type { Role } from "@strim/shared";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  createdAt?: Date;
};

export type AuthOrganization = {
  id: string;
  name: string;
  slug: string;
  role?: Role;
};

export type SessionPayload = {
  token: string;
  user: AuthUser;
  organizations?: AuthOrganization[];
  organization?: AuthOrganization;
};

export type GoogleUserProfile = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
};
