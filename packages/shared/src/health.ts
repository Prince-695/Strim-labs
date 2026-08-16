export type HealthBreakdown = {
  availability: number;
  latency: number;
  errors: number;
  trafficAnomaly: number;
  dependencies: number;
  cache: number;
  saturation: number;
};

export type HealthScore = {
  score: number;
  breakdown: HealthBreakdown;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeHealthScore(input: {
  errorRate: number;
  availability: number;
  p95Ms: number;
  p95BudgetMs?: number;
  rps: number;
  expectedRps?: number;
  dependencyErrorRate?: number;
  cacheHitRate?: number;
  cpuSaturation?: number;
}): HealthScore {
  const budget = input.p95BudgetMs ?? 500;
  const latency = clamp(100 - (input.p95Ms / budget) * 50);
  const errors = clamp(100 - input.errorRate * 1000);
  const availability = clamp(input.availability * 100);
  const expected = input.expectedRps ?? input.rps;
  const trafficAnomaly =
    expected === 0 ? 100 : clamp(100 - (Math.abs(input.rps - expected) / Math.max(expected, 1)) * 50);
  const dependencies = clamp(100 - (input.dependencyErrorRate ?? 0) * 800);
  const cache = clamp((input.cacheHitRate ?? 0.5) * 100);
  const saturation = clamp(100 - (input.cpuSaturation ?? 0.3) * 80);

  const score = clamp(
    availability * 0.25 +
      latency * 0.2 +
      errors * 0.2 +
      trafficAnomaly * 0.1 +
      dependencies * 0.1 +
      cache * 0.08 +
      saturation * 0.07,
  );

  return {
    score,
    breakdown: { availability, latency, errors, trafficAnomaly, dependencies, cache, saturation },
  };
}
