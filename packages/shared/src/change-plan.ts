export const CHANGE_PLAN_STATES = [
  "DRAFT",
  "VALIDATING",
  "SIMULATION_PENDING",
  "SIMULATING",
  "SIMULATION_PASSED",
  "SIMULATION_FAILED",
  "APPROVAL_PENDING",
  "APPROVED",
  "REJECTED",
  "ROLLING_OUT",
  "ROLLOUT_PAUSED",
  "MONITORING",
  "COMPLETED",
  "ROLLBACK_PENDING",
  "ROLLED_BACK",
] as const;

export type ChangePlanState = (typeof CHANGE_PLAN_STATES)[number];

const ALLOWED: Record<ChangePlanState, ChangePlanState[]> = {
  DRAFT: ["VALIDATING"],
  VALIDATING: ["SIMULATION_PENDING", "DRAFT"],
  SIMULATION_PENDING: ["SIMULATING"],
  SIMULATING: ["SIMULATION_PASSED", "SIMULATION_FAILED"],
  SIMULATION_PASSED: ["APPROVAL_PENDING"],
  SIMULATION_FAILED: ["DRAFT", "APPROVAL_PENDING"],
  APPROVAL_PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["ROLLING_OUT"],
  REJECTED: ["DRAFT"],
  ROLLING_OUT: ["MONITORING", "ROLLOUT_PAUSED", "ROLLBACK_PENDING"],
  ROLLOUT_PAUSED: ["ROLLING_OUT", "ROLLBACK_PENDING"],
  MONITORING: ["COMPLETED", "ROLLBACK_PENDING"],
  COMPLETED: [],
  ROLLBACK_PENDING: ["ROLLED_BACK"],
  ROLLED_BACK: [],
};

export function canTransition(from: ChangePlanState, to: ChangePlanState): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: ChangePlanState, to: ChangePlanState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal change-plan transition ${from} → ${to}`);
  }
}

export type ApprovalOverride = {
  allowed: boolean;
  justification?: string;
};

/** FR-9.10.1: cannot reach APPROVED from SIMULATION_FAILED without audited override. */
export function canApprove(params: {
  state: ChangePlanState;
  override?: ApprovalOverride;
}): { ok: boolean; reason?: string } {
  if (params.state === "APPROVED") {
    return { ok: false, reason: "already approved" };
  }
  if (params.state === "SIMULATION_FAILED") {
    if (params.override?.allowed && params.override.justification?.trim()) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "SIMULATION_FAILED requires an explicit justified override to approve",
    };
  }
  if (params.state !== "APPROVAL_PENDING") {
    return { ok: false, reason: `cannot approve from ${params.state}` };
  }
  return { ok: true };
}

export const ROLLOUT_STAGES = [0, 10, 25, 50, 100] as const;
