import { describe, expect, test } from "bun:test";
import { analyzeBreakingPoint, compareRuns } from "@strim/shared";

describe("Breaking Point Analyzer", () => {
  test("identifies sustainable capacity and rate-limit bottleneck (429)", () => {
    const samples: Array<{ rps: number; errorRate: number; p95Ms: number; statusCodes: Record<string, number> }> = [
      { rps: 100, errorRate: 0.0, p95Ms: 45, statusCodes: { "200": 100 } },
      { rps: 300, errorRate: 0.0, p95Ms: 55, statusCodes: { "200": 300 } },
      { rps: 600, errorRate: 0.0, p95Ms: 70, statusCodes: { "200": 600 } },
      { rps: 800, errorRate: 0.005, p95Ms: 110, statusCodes: { "200": 796, "429": 4 } },
      { rps: 1000, errorRate: 0.05, p95Ms: 350, statusCodes: { "200": 950, "429": 50 } },
      { rps: 1200, errorRate: 0.15, p95Ms: 850, statusCodes: { "200": 1020, "429": 180 } },
    ];

    const bp = analyzeBreakingPoint(samples);
    expect(bp.sustainableRps).toBeGreaterThanOrEqual(600);
    expect(bp.failureRps).toBeLessThanOrEqual(1000);
    expect(bp.bottleneck).toBe("RATE_LIMIT_429");
    expect(bp.verdict).toContain("Rate limit threshold hit");
  });

  test("identifies latency cliff when server slows down under load", () => {
    const samples: Array<{ rps: number; errorRate: number; p95Ms: number; statusCodes: Record<string, number> }> = [
      { rps: 100, errorRate: 0.0, p95Ms: 40, statusCodes: { "200": 100 } },
      { rps: 200, errorRate: 0.0, p95Ms: 85, statusCodes: { "200": 200 } },
      { rps: 400, errorRate: 0.0, p95Ms: 450, statusCodes: { "200": 400 } },
      { rps: 600, errorRate: 0.0, p95Ms: 1800, statusCodes: { "200": 600 } },
    ];

    const bp = analyzeBreakingPoint(samples);
    expect(bp.bottleneck).toBe("LATENCY_CLIFF");
    expect(bp.kneeRps).toBe(400);
  });
});

describe("Run Comparison Studio", () => {
  test("computes latency improvement and throughput deltas between Run A and Run B", () => {
    const runA = {
      id: "run-1",
      name: "Baseline v1",
      avgRps: 500,
      p95Ms: 180,
      errorRate: 0.02,
      peakRps: 750,
    };
    const runB = {
      id: "run-2",
      name: "Optimized DB Index v2",
      avgRps: 750,
      p95Ms: 90,
      errorRate: 0.001,
      peakRps: 1100,
    };

    const comp = compareRuns(runA, runB);
    expect(comp.deltas.p95LatencyDeltaPct).toBe(-50.0);
    expect(comp.deltas.avgRpsDeltaPct).toBe(50.0);
    expect(comp.deltas.improved).toBe(true);
    expect(comp.deltas.summary).toContain("improved P95 latency by 50%");
  });
});
