export type ContextRef = {
  organizationId: string;
  workspaceId?: string;
  projectId?: string;
  applicationId?: string;
  environmentId?: string;
};

export type TelemetryEnvelope = {
  schema: "strim.telemetry.v1";
  timestamp: string;
  organizationHint?: string;
  projectId: string;
  environment: string;
  events: TelemetryEvent[];
};

export type TelemetryEvent = {
  type: "span" | "request" | "metric" | "log";
  requestId?: string;
  traceId?: string;
  parentSpanId?: string;
  spanId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  service?: string;
  region?: string;
  headers?: Record<string, string>;
  body?: unknown;
  attributes?: Record<string, unknown>;
};

export type OtlpLikeSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes?: { key: string; value: { stringValue?: string; intValue?: string } }[];
};

export function otlpToEnvelope(input: {
  projectId: string;
  environment: string;
  resourceSpans: { scopeSpans: { spans: OtlpLikeSpan[] }[] }[];
}): TelemetryEnvelope {
  const events: TelemetryEvent[] = [];
  for (const rs of input.resourceSpans) {
    for (const ss of rs.scopeSpans) {
      for (const span of ss.spans) {
        const attrs: Record<string, unknown> = {};
        for (const a of span.attributes ?? []) {
          attrs[a.key] = a.value.stringValue ?? a.value.intValue;
        }
        const start = span.startTimeUnixNano ? Number(span.startTimeUnixNano) / 1e6 : 0;
        const end = span.endTimeUnixNano ? Number(span.endTimeUnixNano) / 1e6 : start;
        events.push({
          type: "span",
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          path: span.name,
          durationMs: end - start,
          service: String(attrs["service.name"] ?? "unknown"),
          attributes: attrs,
        });
      }
    }
  }
  return {
    schema: "strim.telemetry.v1",
    timestamp: new Date().toISOString(),
    projectId: input.projectId,
    environment: input.environment,
    events,
  };
}

export type CacheRecommendation = {
  endpoint: string;
  method: string;
  reason: string;
  projectedOriginReductionPct: number;
};

export function recommendCache(
  endpoints: { path: string; method: string; rps: number; p95Ms: number; changeFrequency: number }[],
): CacheRecommendation[] {
  return endpoints
    .filter((e) => e.method === "GET" && e.rps >= 10 && e.p95Ms >= 80 && e.changeFrequency < 0.1)
    .map((e) => ({
      endpoint: e.path,
      method: e.method,
      reason: "High traffic, high latency, low change frequency",
      projectedOriginReductionPct: Math.min(90, Math.round(40 + e.rps / 10)),
    }));
}

export type SimulateWhatIf =
  | { kind: "traffic"; multiplier: number }
  | { kind: "cache"; enabled: boolean }
  | { kind: "timeout"; fromMs: number; toMs: number }
  | { kind: "dependencyLatency"; factor: number }
  | { kind: "dependencyUnavailable"; dependency: string };

export function modelWhatIf(
  baseline: { p95Ms: number; p99Ms: number; errorRate: number; originRps: number; cacheHitRate: number },
  change: SimulateWhatIf,
): typeof baseline {
  const out = { ...baseline };
  switch (change.kind) {
    case "traffic":
      out.originRps = baseline.originRps * change.multiplier;
      out.p95Ms = baseline.p95Ms * (1 + (change.multiplier - 1) * 0.15);
      out.p99Ms = baseline.p99Ms * (1 + (change.multiplier - 1) * 0.2);
      out.errorRate = baseline.errorRate * (1 + (change.multiplier - 1) * 0.1);
      break;
    case "cache":
      if (change.enabled) {
        out.cacheHitRate = Math.max(baseline.cacheHitRate, 0.7);
        out.originRps = baseline.originRps * (1 - out.cacheHitRate);
        out.p95Ms = baseline.p95Ms * 0.6;
        out.p99Ms = baseline.p99Ms * 0.65;
        out.errorRate = baseline.errorRate * 0.7;
      } else {
        out.cacheHitRate = 0;
        out.originRps = baseline.originRps / Math.max(baseline.cacheHitRate, 0.2);
        out.p95Ms = baseline.p95Ms * 1.4;
      }
      break;
    case "timeout":
      if (change.toMs < change.fromMs) {
        out.p95Ms = baseline.p95Ms * 0.85;
        out.errorRate = baseline.errorRate * 0.9;
      } else {
        out.p95Ms = baseline.p95Ms * 1.1;
      }
      break;
    case "dependencyLatency":
      out.p95Ms = baseline.p95Ms * change.factor;
      out.p99Ms = baseline.p99Ms * change.factor;
      break;
    case "dependencyUnavailable":
      out.errorRate = Math.min(1, baseline.errorRate + 0.4);
      out.p95Ms = baseline.p95Ms * 2;
      break;
  }
  return out;
}

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  TENANT_MISMATCH: "TENANT_MISMATCH",
  RATE_LIMITED: "RATE_LIMITED",
  SIMULATION_REQUIRED: "SIMULATION_REQUIRED",
} as const;
