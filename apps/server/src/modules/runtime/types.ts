import type { HealthBreakdown, HealthScore } from "@strim/shared";

export type { HealthBreakdown, HealthScore };

export type RuntimeOverviewData = {
  application: string;
  environment: string;
  health: {
    score: number;
    breakdown: HealthBreakdown;
  };
  traffic: {
    rps: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  totalRequests: number;
  currentVersion: unknown;
  activeIncidents: unknown[];
};
