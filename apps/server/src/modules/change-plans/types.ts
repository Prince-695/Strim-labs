import type { ChangePlanState, RiskLevel, RiskScore } from "@strim/shared";

export type { ChangePlanState, RiskLevel, RiskScore };

export type CreateChangePlanInput = {
  environmentId: string;
  title: string;
  description: string;
  objective: string;
  proposed: Record<string, unknown>;
  gitCommit?: string;
  gitBranch?: string;
  gitPullRequest?: string;
};

export type UpdateChangePlanInput = {
  title?: string;
  description?: string;
  objective?: string;
  gitCommit?: string;
  gitBranch?: string;
  gitPullRequest?: string;
};

export type ApproveChangePlanInput = {
  override?: boolean;
  justification?: string;
};

export type GuardrailCheckInput = {
  errorRate?: number;
  p95Ms?: number;
  availability?: number;
};

export type GuardrailCheckResult = {
  action: "continue" | "pause" | "stop" | "rollback";
  reason?: string;
  metrics: {
    errorRate: number;
    p95Ms: number;
    availability: number;
  };
};

export type RolloutResult = {
  changePlanId: string;
  rolloutPercent: number;
  state: ChangePlanState;
  completed: boolean;
};

export type RollbackResult = {
  changePlanId: string;
  restoredVersionId: string;
  state: ChangePlanState;
  rolloutPercent: number;
};
