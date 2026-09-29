export type WhatIfChange =
  | { kind: "traffic"; multiplier: number }
  | { kind: "cache"; enabled: boolean }
  | { kind: "timeout"; fromMs: number; toMs: number }
  | { kind: "dependencyLatency"; factor: number; dependency?: string }
  | { kind: "dependencyUnavailable"; dependency: string };

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

export type PassFailEvaluation = {
  passed: boolean;
  regressed: boolean;
  reasons: string[];
  recommendation: string;
};

export type CreateSimulationInput = {
  environmentId: string;
  name?: string;
  scenarioId?: string;
  change: WhatIfChange;
  customBaseline?: ComparisonMetrics;
  maxErrorRateDeltaPct?: number;
  maxP95DeltaPct?: number;
};

export type SimulationRecord = {
  id: string;
  organizationId: string;
  environmentId: string;
  scenarioId: string | null;
  status: string;
  baseline: ComparisonMetrics | null;
  experiment: ComparisonMetrics | null;
  comparison: ComparisonDelta[] | null;
  evaluation?: PassFailEvaluation;
  createdAt: Date;
};
