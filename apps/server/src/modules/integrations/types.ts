export type CiGateInput = {
  changePlanId: string;
  p95RegressionPct: number;
  thresholdPct?: number;
};

export type CiGateResult = {
  result: "PASS" | "FAIL";
  reason: string;
  changePlanId: string;
};

export type CreateDeploymentInput = {
  environmentId: string;
  source: string;
  sha?: string;
  metadata?: Record<string, unknown>;
};

export type CreatePagingIntegrationInput = {
  provider: string;
  config: Record<string, unknown>;
};

export type LineageChainStep =
  | { step: "git_commit"; ref: string | null }
  | { step: "deployment"; refs: unknown[] }
  | { step: "runtime_change"; id: string }
  | { step: "simulation"; id: string | null }
  | { step: "rollout"; items: unknown[] }
  | { step: "incidents"; items: unknown[] };

export type LineageChainResult = {
  chain: LineageChainStep[];
};
