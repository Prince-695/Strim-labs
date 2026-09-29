export type LoadTestKind = "load" | "stress" | "spike" | "endurance" | "capacity";

export type LoadTestStatus = "queued" | "running" | "completed" | "failed" | "stopped";

export type LoadTestConfig = {
  environmentId: string;
  kind: LoadTestKind;
  name?: string;
  targetRps: number;
  durationSeconds: number;
  scale: number;
  targetUrl?: string;
  method?: string;
  concurrency?: number;
  headers?: Record<string, string>;
  preserveDistribution?: boolean;
  auditDefensivePosture?: boolean;
};

export type SampleMetric = {
  timestamp: string;
  rps: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
};

export type EndpointDistribution = {
  path: string;
  pct: number;
  rps: number;
};

export type BreakingPointResult = {
  sustainableRps: number;
  degradationOnsetRps: number;
  criticalFailureRps: number;
  recommendation: string;
};

export type DefensiveCategory = "rate_limiting" | "error_hygiene" | "timeout_resilience" | "backpressure";

export type DefensiveFinding = {
  category: DefensiveCategory;
  status: "PASS" | "WARN" | "FAIL";
  observation: string;
  recommendation: string;
};

export type DefensivePostureAudit = {
  overallGrade: "A+" | "A" | "B" | "C" | "F";
  score: number;
  rateLimitEnforced: boolean;
  leakedStackTraces: boolean;
  unhandledServerErrors: number;
  findings: DefensiveFinding[];
};

export type LoadTestSummary = {
  totalRequests: number;
  avgRps: number;
  peakRps: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  statusCodes: Record<string, number>;
};

export type LoadTestResult = {
  distribution: EndpointDistribution[];
  samples: SampleMetric[];
  summary: LoadTestSummary;
  defensivePosture?: DefensivePostureAudit;
};

export type LoadTestRecord = {
  id: string;
  organizationId: string;
  environmentId: string;
  kind: string;
  status: string;
  config: LoadTestConfig;
  result: LoadTestResult | null;
  breakingPoint: BreakingPointResult | null;
  createdAt: Date;
};
