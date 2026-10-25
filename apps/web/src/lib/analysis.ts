import { fmtErrorRate, fmtMs, fmtRps, groupStatusCodes, isNum } from "./format";
import type { Bottleneck, TestRun } from "./types";

export type Diagnosis = {
  /** "ok" = breaking point identified, "none" = no breaking point observed, "insufficient" = not enough evidence */
  quality: "ok" | "none" | "insufficient";
  qualityNote: string;
  observed: string[];
  hypothesis: string;
  nextChecks: string[];
};

const MIN_REQUESTS_FOR_ANALYSIS = 200;

/**
 * Builds the evidence card from a run. Everything under "observed" is read straight from run data;
 * the hypothesis is explicitly worded as a hypothesis and never claims a confirmed root cause.
 */
export function diagnose(run: TestRun): Diagnosis {
  const observed: string[] = [];
  const codes = groupStatusCodes(run.statusCodes);
  const total = run.totalRequests;

  if (isNum(run.peakRps)) observed.push(`Peak throughput reached ${fmtRps(run.peakRps)} RPS (average ${fmtRps(run.avgRps)} RPS).`);
  if (isNum(run.p95Ms)) observed.push(`P95 latency over the run was ${fmtMs(run.p95Ms)}; P99 was ${fmtMs(run.p99Ms)}.`);
  if (isNum(run.errorRate)) observed.push(`Error rate was ${fmtErrorRate(run.errorRate)} across ${isNum(total) ? total.toLocaleString("en-US") : "—"} requests.`);
  if (codes.c429 > 0) observed.push(`${codes.c429.toLocaleString("en-US")} responses were HTTP 429.`);
  if (codes.c5xx > 0) observed.push(`${codes.c5xx.toLocaleString("en-US")} responses were HTTP 5xx.`);

  const samples = run.samples ?? [];
  if (samples.length >= 4) {
    const first = samples.slice(0, Math.max(2, Math.floor(samples.length * 0.2)));
    const last = samples.slice(-Math.max(2, Math.floor(samples.length * 0.2)));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const early = avg(first.map((s) => s.p95Ms));
    const late = avg(last.map((s) => s.p95Ms));
    if (early > 0 && Number.isFinite(late)) {
      observed.push(`Sampled P95 moved from ${fmtMs(early)} (first 20% of samples) to ${fmtMs(late)} (last 20%).`);
    }
  }

  const bp = run.breakingPoint;
  const tooSmall = !isNum(total) || total < MIN_REQUESTS_FOR_ANALYSIS || samples.length < 6;

  if (!bp || tooSmall) {
    return {
      quality: "insufficient",
      qualityNote: "Insufficient evidence to determine a breaking point from this run.",
      observed,
      hypothesis:
        "This run is too short or too light to separate normal variation from saturation. No claim is made about where this API's limit sits.",
      nextChecks: [
        "Re-run with the Capacity Ramp preset so load increases steadily across the whole run.",
        "Use a longer duration so there are enough 500 ms samples on each side of the knee.",
        "Confirm the target responds consistently with a Smoke Probe first.",
      ],
    };
  }

  if (bp.bottleneck === "NONE") {
    return {
      quality: "none",
      qualityNote: "No breaking point observed within this test.",
      observed,
      hypothesis:
        "Latency and errors stayed within normal range for the load applied. That shows the API handled this load; it does not show that capacity is unlimited.",
      nextChecks: [
        "Try the Breaking Point Hunt preset to push past this load level.",
        "Check whether the load generator, not the API, was the limiting side.",
      ],
    };
  }

  return {
    quality: "ok",
    qualityNote: `Estimated from ${samples.length} samples. Knee near ${fmtRps(bp.kneeRps)} RPS, failures from ${fmtRps(bp.failureRps)} RPS.`,
    observed,
    hypothesis: HYPOTHESES[bp.bottleneck](bp.failureRps, bp.kneeRps),
    nextChecks: NEXT_CHECKS[bp.bottleneck],
  };
}

const HYPOTHESES: Record<Exclude<Bottleneck, "NONE">, (failure: number, knee: number) => string> = {
  RATE_LIMIT_429: (f) =>
    `429 responses rose above the observed rate near ${fmtRps(f)} RPS. This is consistent with a rate limiter; it has not been confirmed as the cause. Inspect gateway and application limiter configuration.`,
  LATENCY_CLIFF: (_f, k) =>
    `P95 latency curved sharply upward around ${fmtRps(k)} RPS while throughput flattened. This pattern is consistent with queueing at a shared resource (workers, connection pool or a downstream call). Latency alone does not identify which one.`,
  SERVER_ERROR_5XX: (f) =>
    `5xx responses began appearing near ${fmtRps(f)} RPS. This suggests the service failed under load, but the status codes alone do not show whether the cause is application code, a dependency or the proxy in front of it.`,
  TIMEOUTS: (f) =>
    `Requests started timing out near ${fmtRps(f)} RPS. This is consistent with saturation or a gateway timeout, and needs server-side metrics to confirm.`,
};

const NEXT_CHECKS: Record<Exclude<Bottleneck, "NONE">, string[]> = {
  RATE_LIMIT_429: [
    "Check token-bucket or leaky-bucket limits on the reverse proxy and API gateway.",
    "Look for per-IP limits: all load comes from one source address.",
    "Compare the first 429 timestamp with the RPS at that moment in the chart.",
  ],
  LATENCY_CLIFF: [
    "Check connection-pool wait time and pool size on the service and its database.",
    "Check CPU, event-loop lag and worker thread counts at the knee timestamp.",
    "Look for a slow downstream dependency that serialises requests.",
  ],
  SERVER_ERROR_5XX: [
    "Read application error logs for the minute the first 5xx appeared.",
    "Check out-of-memory kills, restarts and health-check failures.",
    "Check upstream and proxy logs for connection resets.",
  ],
  TIMEOUTS: [
    "Compare the gateway timeout setting with the P99 latency reported here.",
    "Check whether keep-alive or file-descriptor limits were reached.",
    "Run a lower-load probe to confirm timeouts disappear below the knee.",
  ],
};

export const BOTTLENECK_LABEL: Record<Bottleneck, string> = {
  RATE_LIMIT_429: "Rate limit (429)",
  LATENCY_CLIFF: "Latency cliff",
  SERVER_ERROR_5XX: "Server errors (5xx)",
  TIMEOUTS: "Timeouts",
  NONE: "None observed",
};
