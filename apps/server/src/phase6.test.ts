import { describe, expect, test } from "bun:test";
import { hedge, lintCausality } from "@strim/shared";
import { evaluateCiGate } from "./modules/integrations/service";
import { createRetentionPolicy } from "./modules/billing/service";

describe("Phase 6: Grounded AI Copilot & Causality Hedging", () => {
  test("lintCausality flags unverified causal claims and hedges them", () => {
    const raw = "The deployment caused latency to increase significantly.";
    const lintResult = lintCausality(raw);
    expect(lintResult.ok).toBe(false);
    expect(lintResult.matches.length).toBeGreaterThan(0);

    const hedged = hedge(raw);
    expect(hedged).toContain("potential contributing factor");
    expect(lintCausality(hedged).ok).toBe(true);
  });

  test("lintCausality passes non-causal descriptions unchanged", () => {
    const raw = "P95 latency is currently 145ms across 12 pods.";
    const result = lintCausality(raw);
    expect(result.ok).toBe(true);
    expect(result.matches.length).toBe(0);
  });
});

describe("Phase 6: CI Quality Gates", () => {
  test("passes when regression is within threshold", async () => {
    const mockDb = {
      changePlan: {
        findFirst: async () => ({ id: "cplan_123" }),
      },
    } as any;

    const result = await evaluateCiGate(mockDb, "org_test", {
      changePlanId: "cplan_123",
      p95RegressionPct: 12.5,
      thresholdPct: 20,
    });

    expect(result.result).toBe("PASS");
    expect(result.changePlanId).toBe("cplan_123");
  });

  test("fails when regression exceeds threshold", async () => {
    const mockDb = {
      changePlan: {
        findFirst: async () => ({ id: "cplan_123" }),
      },
    } as any;

    const result = await evaluateCiGate(mockDb, "org_test", {
      changePlanId: "cplan_123",
      p95RegressionPct: 35.0,
      thresholdPct: 20,
    });

    expect(result.result).toBe("FAIL");
    expect(result.reason).toContain("exceeds threshold of 20%");
  });
});

describe("Phase 6: Billing & Data Retention Compliance", () => {
  test("enforces 365-day statutory minimum floor for audit data class", async () => {
    const mockDb = {} as any;

    expect(
      createRetentionPolicy(mockDb, "org_test", {
        dataClass: "audit",
        days: 90,
      }),
    ).rejects.toThrow("AUDIT_RETENTION_FLOOR_BREACH");
  });

  test("accepts valid retention policies meeting floor requirement", async () => {
    const mockDb = {
      retentionPolicy: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({ id: "ret_1", ...data }),
      },
    } as any;

    const policy = await createRetentionPolicy(mockDb, "org_test", {
      dataClass: "audit",
      days: 365,
    });

    expect(policy.days).toBe(365);
    expect(policy.dataClass).toBe("audit");
  });
});

describe("Phase 6: Chaos Engineering Guardrails", () => {
  test("forbids non-admin users from launching chaos in production", async () => {
    const mockDb = {
      environment: {
        findFirst: async () => ({ id: "env_prod", type: "PRODUCTION" }),
      },
    } as any;

    const { startChaosExperiment } = await import("./modules/billing/service");

    expect(
      startChaosExperiment(
        mockDb,
        "org_test",
        {
          environmentId: "env_prod",
          kind: "latency",
          target: "payment-gateway",
        },
        "ENGINEER",
        "user_123",
      ),
    ).rejects.toThrow("FORBIDDEN_PRODUCTION_CHAOS");
  });
});

