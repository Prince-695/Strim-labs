export type RuntimeDiffEntry = {
  key: string;
  from: unknown;
  to: unknown;
};

export function diffRuntimeState(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
): RuntimeDiffEntry[] {
  const keys = new Set([...Object.keys(current), ...Object.keys(proposed)]);
  const diffs: RuntimeDiffEntry[] = [];
  for (const key of [...keys].sort()) {
    const from = current[key];
    const to = proposed[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diffs.push({ key, from: from ?? null, to: to ?? null });
    }
  }
  return diffs;
}

export function formatDiffLine(entry: RuntimeDiffEntry): string {
  return `${entry.key}: ${stringify(entry.from)} → ${stringify(entry.to)}`;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export type ComparisonMetrics = {
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  originRps: number;
  cacheHitRate: number;
};

export type ComparisonDelta = {
  metric: keyof ComparisonMetrics;
  baseline: number;
  experiment: number;
  deltaPct: number;
};

export function compareRuns(baseline: ComparisonMetrics, experiment: ComparisonMetrics): ComparisonDelta[] {
  const metrics: (keyof ComparisonMetrics)[] = ["p95Ms", "p99Ms", "errorRate", "originRps", "cacheHitRate"];
  return metrics.map((metric) => {
    const b = baseline[metric];
    const e = experiment[metric];
    const deltaPct = b === 0 ? (e === 0 ? 0 : 100) : ((e - b) / b) * 100;
    return { metric, baseline: b, experiment: e, deltaPct };
  });
}

export type BreakingPoint = {
  sustainableRps: number;
  degradationOnsetRps: number;
  criticalFailureRps: number;
  recommendation: string;
};

export function analyzeBreakingPoint(samples: { rps: number; errorRate: number; p95Ms: number }[]): BreakingPoint {
  const sorted = [...samples].sort((a, b) => a.rps - b.rps);
  let degradation = sorted[sorted.length - 1]?.rps ?? 0;
  let critical = degradation;
  let sustainable = sorted[0]?.rps ?? 0;
  for (const s of sorted) {
    if (s.errorRate < 0.01 && s.p95Ms < 500) sustainable = s.rps;
    if (s.errorRate >= 0.02 || s.p95Ms >= 800) {
      degradation = Math.min(degradation, s.rps);
    }
    if (s.errorRate >= 0.05 || s.p95Ms >= 2000) {
      critical = Math.min(critical, s.rps);
      break;
    }
  }
  return {
    sustainableRps: sustainable,
    degradationOnsetRps: degradation,
    criticalFailureRps: critical,
    recommendation: `Keep traffic at or below ${sustainable} RPS. Degradation begins near ${degradation} RPS; critical failure near ${critical} RPS.`,
  };
}
