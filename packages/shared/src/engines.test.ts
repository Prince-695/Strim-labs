import { describe, expect, test } from "bun:test";
import {
  blastRadius,
  canApprove,
  canTransition,
  compareRuns,
  computeHealthScore,
  computeRiskScore,
  diffRuntimeState,
  formatDiffLine,
  hedge,
  inRollout,
  isDangerousReplayTarget,
  lintCausality,
  parseNlQuery,
  redactHeaders,
  redactJson,
  redactString,
  recommendCache,
  analyzeBreakingPoint,
  modelWhatIf,
} from "@strim/shared";

describe("redaction", () => {
  test("redacts bearer, cookie, and PAN", () => {
    const headers = redactHeaders({
      Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
      Cookie: "session=abc",
      "X-Request-Id": "ok",
    });
    expect(headers.Authorization).toBe("[REDACTED]");
    expect(headers.Cookie).toBe("[REDACTED]");
    expect(headers["X-Request-Id"]).toBe("ok");
    const body = redactJson({
      card: "4111111111111111",
      note: "pay with 4111 1111 1111 1111",
    }) as Record<string, string>;
    expect(body.card).toBe("[REDACTED]");
    expect(String(body.note)).toContain("[REDACTED]");
  });
});

describe("health score", () => {
  test("always includes breakdown", () => {
    const h = computeHealthScore({
      errorRate: 0.01,
      availability: 0.999,
      p95Ms: 120,
      rps: 50,
    });
    expect(h.score).toBeGreaterThan(0);
    expect(h.breakdown.availability).toBeDefined();
    expect(h.breakdown.errors).toBeDefined();
  });
});

describe("runtime diff", () => {
  test("formats cache.enabled false to true", () => {
    const diffs = diffRuntimeState(
      { "cache.enabled": false, "cache.ttl": 0 },
      { "cache.enabled": true, "cache.ttl": 60 },
    );
    expect(diffs.map(formatDiffLine).join("\n")).toContain("cache.enabled: false → true");
  });
});

describe("change plan machine", () => {
  test("cannot approve simulation failed without override", () => {
    expect(canApprove({ state: "SIMULATION_FAILED" }).ok).toBe(false);
    expect(
      canApprove({ state: "SIMULATION_FAILED", override: { allowed: true, justification: "hotfix" } }).ok,
    ).toBe(true);
    expect(canTransition("APPROVED", "ROLLING_OUT")).toBe(true);
  });
});

describe("risk and blast radius", () => {
  test("incident history increases risk", () => {
    const low = computeRiskScore({
      blastRadiusServices: 1,
      trafficVolumeRps: 10,
      affectedServiceCount: 1,
      dependencySensitivity: 0.1,
      historicalIncidentCount: 0,
      configDiffMagnitude: 1,
      simulationRegressed: false,
    });
    const high = computeRiskScore({
      blastRadiusServices: 1,
      trafficVolumeRps: 10,
      affectedServiceCount: 1,
      dependencySensitivity: 0.1,
      historicalIncidentCount: 4,
      configDiffMagnitude: 1,
      simulationRegressed: false,
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  test("blast radius walks dependents", () => {
    const r = blastRadius("payments", [
      { from: "checkout", to: "payments" },
      { from: "web", to: "checkout" },
    ]);
    expect(r).toContain("checkout");
    expect(r).toContain("web");
  });
});

describe("sdk rollout bucket", () => {
  test("stable for a key", () => {
    expect(inRollout("user-1", 0)).toBe(false);
    expect(inRollout("user-1", 100)).toBe(true);
    expect(inRollout("user-1", 50)).toBe(inRollout("user-1", 50));
  });
});

describe("replay safety", () => {
  test("blocks payment capture", () => {
    expect(isDangerousReplayTarget("POST", "/payments/capture")).toBe(true);
    expect(isDangerousReplayTarget("GET", "/products")).toBe(false);
  });
});

describe("comparison and what-if", () => {
  test("cache on reduces origin rps", () => {
    const base = { p95Ms: 400, p99Ms: 800, errorRate: 0.02, originRps: 100, cacheHitRate: 0 };
    const exp = modelWhatIf(base, { kind: "cache", enabled: true });
    expect(exp.originRps).toBeLessThan(base.originRps);
    expect(exp.p95Ms).toBeLessThan(base.p95Ms);
    const cmp = compareRuns(base, exp);
    expect(cmp.find((c) => c.metric === "originRps")?.deltaPct).toBeLessThan(0);
  });

  test("breaking point finds saturation", () => {
    const bp = analyzeBreakingPoint([
      { rps: 50, errorRate: 0.001, p95Ms: 100 },
      { rps: 100, errorRate: 0.002, p95Ms: 120 },
      { rps: 200, errorRate: 0.03, p95Ms: 900 },
      { rps: 400, errorRate: 0.2, p95Ms: 3000 },
    ]);
    expect(bp.sustainableRps).toBeLessThan(bp.criticalFailureRps);
    expect(bp.recommendation).toContain("RPS");
  });
});

describe("ai causality", () => {
  test("lints unqualified cause", () => {
    expect(lintCausality("Config X caused the incident").ok).toBe(false);
    expect(lintCausality(hedge("Config X caused the incident")).ok).toBe(true);
  });

  test("parses canonical questions", () => {
    expect(parseNlQuery("Which endpoints are good cache candidates?").type).toBe("cache_candidates");
    expect(parseNlQuery("Show me the last three rollbacks").type).toBe("last_rollbacks");
  });
});

describe("cache recommendations", () => {
  test("flags hot slow stable GET", () => {
    const recs = recommendCache([
      { path: "/products", method: "GET", rps: 80, p95Ms: 220, changeFrequency: 0.02 },
      { path: "/pay", method: "POST", rps: 80, p95Ms: 220, changeFrequency: 0.02 },
    ]);
    expect(recs[0]?.endpoint).toBe("/products");
  });
});
