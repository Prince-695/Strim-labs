import { errorRateToPct } from "./format";
import type { ComparisonResult, TestRun } from "./types";

export type GateThresholds = {
  /** Max P95 latency degradation, percent. */
  maxLatencyDegradationPct: number;
  /** Max error-rate increase, percentage points. */
  maxErrorRateIncreasePct: number;
  /** Minimum average throughput retained, percent of baseline. */
  minThroughputRetentionPct: number;
};

export const DEFAULT_THRESHOLDS: GateThresholds = {
  maxLatencyDegradationPct: 10,
  maxErrorRateIncreasePct: 0.5,
  minThroughputRetentionPct: 90,
};

export type GateVerdict = {
  verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
  reasons: string[];
  /** Which individual checks breached — drives per-card highlighting. */
  breached: { latency: boolean; errors: boolean; throughput: boolean };
};

const MIN_REQUESTS = 100;

export type Compatibility = { comparable: boolean; warnings: string[] };

/** Flags differences that make a baseline/candidate comparison unreliable. */
export function checkCompatibility(a?: TestRun | null, b?: TestRun | null): Compatibility {
  const warnings: string[] = [];
  if (!a || !b) return { comparable: true, warnings };
  if (a.targetUrl !== b.targetUrl) warnings.push("The runs hit different target URLs.");
  if (a.method !== b.method) warnings.push(`Request methods differ (${a.method} vs ${b.method}).`);
  if (a.profile !== b.profile) warnings.push("Load profiles differ, so the traffic shapes are not equivalent.");
  if (a.concurrency !== b.concurrency) warnings.push(`Concurrency differs (${a.concurrency} vs ${b.concurrency} VUs).`);
  if (a.durationSec !== b.durationSec) warnings.push(`Durations differ (${a.durationSec}s vs ${b.durationSec}s).`);
  return { comparable: warnings.length === 0, warnings };
}

export function evaluateGate(
  comparison: ComparisonResult | null | undefined,
  t: GateThresholds,
  opts: { sameRun?: boolean; runA?: TestRun | null; runB?: TestRun | null } = {},
): GateVerdict {
  const none = { latency: false, errors: false, throughput: false };
  if (!comparison) return { verdict: "INCONCLUSIVE", reasons: ["Select a baseline and a candidate run."], breached: none };
  if (opts.sameRun || comparison.runA.id === comparison.runB.id) {
    return { verdict: "INCONCLUSIVE", reasons: ["The baseline and candidate are the same run."], breached: none };
  }

  const small = [opts.runA, opts.runB].some((r) => r && r.totalRequests < MIN_REQUESTS);
  if (small) {
    return {
      verdict: "INCONCLUSIVE",
      reasons: [`At least one run sent fewer than ${MIN_REQUESTS} requests — too little data for a reliable verdict.`],
      breached: none,
    };
  }

  const d = comparison.deltas;
  const latencyDelta = d.p95LatencyDeltaPct;
  // `errorRateDelta` is a fraction difference (0.021 = +2.1 points); convert through the shared helper.
  const errorDeltaPts = errorRateToPct(d.errorRateDelta);
  const retained = 100 + d.avgRpsDeltaPct;

  const reasons: string[] = [];
  const breached = { latency: false, errors: false, throughput: false };

  if (latencyDelta > t.maxLatencyDegradationPct) {
    breached.latency = true;
    reasons.push(`P95 latency slowed by +${latencyDelta.toFixed(1)}%, exceeding the ${t.maxLatencyDegradationPct.toFixed(1)}% limit.`);
  }
  if (errorDeltaPts > t.maxErrorRateIncreasePct) {
    breached.errors = true;
    reasons.push(`Error rate rose by +${errorDeltaPts.toFixed(2)} points, exceeding the ${t.maxErrorRateIncreasePct.toFixed(1)}-point limit.`);
  }
  if (retained < t.minThroughputRetentionPct) {
    breached.throughput = true;
    reasons.push(`Throughput retention is ${retained.toFixed(1)}%, below the ${t.minThroughputRetentionPct}% requirement.`);
  }

  if (reasons.length) return { verdict: "FAIL", reasons, breached };
  return {
    verdict: "PASS",
    reasons: ["Latency, error rate and throughput are all within the configured tolerances."],
    breached,
  };
}
