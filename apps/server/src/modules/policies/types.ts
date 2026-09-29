export type PolicyScope =
  | "organization"
  | "workspace"
  | "application"
  | "environment"
  | "api_key"
  | "user"
  | "ip"
  | "endpoint";

export type CreatePolicyInput = {
  kind: string;
  name: string;
  body: Record<string, unknown>;
  environmentId?: string;
};

export type UpdatePolicyInput = {
  name?: string;
  body?: Record<string, unknown>;
  environmentId?: string;
};

export type CreateRateLimitInput = {
  scope: PolicyScope;
  scopeId?: string;
  limit: number;
  windowSeconds?: number;
};

export type UpdateRateLimitInput = {
  scope?: PolicyScope;
  scopeId?: string;
  limit?: number;
  windowSeconds?: number;
};

export type CreatePromotionInput = {
  fromEnvId: string;
  toEnvId: string;
  requireSimulation?: boolean;
};

export type CheckDriftInput = {
  environmentId: string;
  actual: Record<string, unknown>;
};

export type DriftAction = "inspect" | "accept" | "correct" | "create_change_plan";
