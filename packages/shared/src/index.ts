export type Role = "OWNER" | "MEMBER";

export function roleAtLeast(role: Role, min: Role): boolean {
  if (role === "OWNER") return true;
  return min === "MEMBER";
}

export type RunProfile = "SUSTAINED" | "RAMP_UP" | "SPIKE";

export type RunStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "ABORTED";

export type BreakingPointAnalysis = {
  kneeRps: number;
  failureRps: number;
  sustainableRps: number;
  bottleneck: "RATE_LIMIT_429" | "LATENCY_CLIFF" | "SERVER_ERROR_5XX" | "TIMEOUTS" | "NONE";
  verdict: string;
};

export type SampleMetric = {
  timestamp: string;
  rps: number;
  activeVUs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorCount: number;
  statusCodes: Record<string, number>;
};

export type RunComparison = {
  runA: { id: string; name: string; avgRps: number; p95Ms: number; errorRate: number; peakRps: number };
  runB: { id: string; name: string; avgRps: number; p95Ms: number; errorRate: number; peakRps: number };
  deltas: {
    avgRpsDeltaPct: number;
    p95LatencyDeltaPct: number;
    errorRateDelta: number;
    peakRpsDeltaPct: number;
    improved: boolean;
    summary: string;
  };
};

/**
 * Analyzes time-series samples to find the exact saturation knee and failure point.
 */
export function analyzeBreakingPoint(
  samples: { rps: number; errorRate: number; p95Ms: number; statusCodes?: Record<string, number> }[],
): BreakingPointAnalysis {
  if (samples.length === 0) {
    return {
      kneeRps: 0,
      failureRps: 0,
      sustainableRps: 0,
      bottleneck: "NONE",
      verdict: "No samples recorded to determine breaking point.",
    };
  }

  const sorted = [...samples].sort((a, b) => a.rps - b.rps);
  const baseline = sorted[0]?.p95Ms ?? 50;

  let kneeRps = sorted[sorted.length - 1]?.rps ?? 0;
  let failureRps = sorted[sorted.length - 1]?.rps ?? 0;
  let sustainableRps = sorted[0]?.rps ?? 0;
  let bottleneck: BreakingPointAnalysis["bottleneck"] = "NONE";

  for (const s of sorted) {
    const rateLimits = s.statusCodes?.["429"] ?? 0;
    const serverErrors = (s.statusCodes?.["500"] ?? 0) + (s.statusCodes?.["502"] ?? 0) + (s.statusCodes?.["503"] ?? 0);
    const timeouts = s.statusCodes?.["504"] ?? 0;

    // Sustainable capacity: error rate < 1% and P95 within 1.5x of baseline
    if (s.errorRate < 0.01 && s.p95Ms <= Math.max(300, baseline * 1.5)) {
      sustainableRps = Math.max(sustainableRps, s.rps);
    }

    // Latency Knee: P95 increases significantly above baseline
    if (s.p95Ms > Math.max(400, baseline * 1.8) && kneeRps === sorted[sorted.length - 1]?.rps) {
      kneeRps = s.rps;
      if (bottleneck === "NONE") bottleneck = "LATENCY_CLIFF";
    }

    // Failure Point: Errors or timeouts climb
    if (s.errorRate >= 0.03 || s.p95Ms >= 1500) {
      failureRps = Math.min(failureRps, s.rps);
      if (rateLimits > serverErrors && rateLimits > timeouts) {
        bottleneck = "RATE_LIMIT_429";
      } else if (timeouts > serverErrors) {
        bottleneck = "TIMEOUTS";
      } else if (serverErrors > 0) {
        bottleneck = "SERVER_ERROR_5XX";
      }
      break;
    }
  }

  if (failureRps === sorted[sorted.length - 1]?.rps && bottleneck === "NONE") {
    kneeRps = Math.round(sustainableRps * 1.2);
    failureRps = Math.round(sustainableRps * 1.5);
  }

  let verdict = `Target is safe and reliable up to ${sustainableRps} RPS (P95 latency maintained). `;
  if (bottleneck === "RATE_LIMIT_429") {
    verdict += `Rate limit threshold hit at ${failureRps} RPS (HTTP 429 backpressure).`;
  } else if (bottleneck === "LATENCY_CLIFF") {
    verdict += `Performance degrades significantly near ${kneeRps} RPS with latency cliff.`;
  } else if (bottleneck === "TIMEOUTS") {
    verdict += `Upstream gateway timeouts (HTTP 504) encountered at ${failureRps} RPS.`;
  } else if (bottleneck === "SERVER_ERROR_5XX") {
    verdict += `Internal server failures (HTTP 5xx) begin at ${failureRps} RPS.`;
  } else {
    verdict += `No critical bottleneck encountered during the test run window.`;
  }

  return {
    kneeRps,
    failureRps,
    sustainableRps,
    bottleneck,
    verdict,
  };
}

/**
 * Compares two load test runs and produces a delta summary.
 */
export function compareRuns(
  runA: { id: string; name: string; avgRps: number; p95Ms: number; errorRate: number; peakRps: number },
  runB: { id: string; name: string; avgRps: number; p95Ms: number; errorRate: number; peakRps: number },
): RunComparison {
  const avgRpsDeltaPct = runA.avgRps > 0 ? Number((((runB.avgRps - runA.avgRps) / runA.avgRps) * 100).toFixed(1)) : 0;
  const p95LatencyDeltaPct = runA.p95Ms > 0 ? Number((((runB.p95Ms - runA.p95Ms) / runA.p95Ms) * 100).toFixed(1)) : 0;
  const errorRateDelta = Number((runB.errorRate - runA.errorRate).toFixed(4));
  const peakRpsDeltaPct = runA.peakRps > 0 ? Number((((runB.peakRps - runA.peakRps) / runA.peakRps) * 100).toFixed(1)) : 0;

  const improved = p95LatencyDeltaPct <= 0 && errorRateDelta <= 0;

  let summary = "";
  if (p95LatencyDeltaPct < -5) {
    summary = `Run B (${runB.name}) improved P95 latency by ${Math.abs(p95LatencyDeltaPct)}% compared to Run A.`;
  } else if (p95LatencyDeltaPct > 5) {
    summary = `Run B regressed: P95 latency increased by ${p95LatencyDeltaPct}% compared to Run A.`;
  } else {
    summary = `Run B performed similarly to Run A with minor latency variation (${p95LatencyDeltaPct}%).`;
  }

  return {
    runA,
    runB,
    deltas: {
      avgRpsDeltaPct,
      p95LatencyDeltaPct,
      errorRateDelta,
      peakRpsDeltaPct,
      improved,
      summary,
    },
  };
}
