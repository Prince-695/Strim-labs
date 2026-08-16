export const ROLES = [
  "OWNER",
  "ADMIN",
  "ENGINEER",
  "DEVELOPER",
  "VIEWER",
  "BILLING",
] as const;

export type Role = (typeof ROLES)[number];

export const MEMBERSHIP_SCOPES = [
  "ORGANIZATION",
  "WORKSPACE",
  "PROJECT",
  "APPLICATION",
] as const;

export type MembershipScope = (typeof MEMBERSHIP_SCOPES)[number];

export const API_KEY_SCOPES = [
  "telemetry:write",
  "config:read",
  "config:write",
  "simulation:write",
  "rollout:write",
  "replay:staging",
  "replay:production",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  BILLING: 1,
  DEVELOPER: 2,
  ENGINEER: 3,
  ADMIN: 4,
  OWNER: 5,
};

export function roleAtLeast(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Production-tier actions require Engineer+ at the application or org scope. */
export const PRODUCTION_TIER_ACTIONS = [
  "config:write:production",
  "replay:production",
  "rollout:approve",
  "rollback",
] as const;

export type ProductionTierAction = (typeof PRODUCTION_TIER_ACTIONS)[number];
