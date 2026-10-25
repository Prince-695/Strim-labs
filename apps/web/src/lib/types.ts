export type Org = {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "MEMBER";
};

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type Project = {
  id: string;
  name: string;
  baseUrl?: string;
  targetUrl: string;
  defaultMethod: HttpMethod;
  defaultHeaders?: Record<string, string>;
  apiKey?: string;
  apiKeyPrefix?: string;
  status?: "PENDING_SDK" | "ACTIVE" | "DEGRADED" | "INCIDENT" | string;
  createdAt: string;
  testRuns?: Array<{
    id: string;
    name: string;
    status: TestStatus;
    avgRps: number;
    peakRps: number;
    p95Ms: number;
    breakingPoint?: BreakingPointAnalysis | null;
    createdAt: string;
  }>;
  _count?: {
    testRuns?: number;
    discoveredRoutes?: number;
    telemetryMetrics?: number;
  };
};

export type DiscoveredRoute = {
  id: string;
  projectId: string;
  path: string;
  method: string;
  isSafe: boolean;
  totalCalls: number;
  errorCalls: number;
  avgDurationMs: number;
  p95DurationMs: number;
  lastSeenAt: string;
  firstSeenAt: string;
};

export type ObservabilitySummary = {
  status: string;
  totalRequests: number;
  totalSuccess: number;
  totalWarning: number;
  totalError: number;
  passRatio: number;
  failRatio: number;
  avgP50Ms: number;
  avgP95Ms: number;
  avgP99Ms: number;
  recentMetrics: Array<{
    id: string;
    timestamp: string;
    totalRequests: number;
    successCount: number;
    warningCount: number;
    errorCount: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  }>;
  latestBreakpoint?: BreakingPointAnalysis | null;
  latestTestRun?: TestRun | null;
};

export type TestProfile = "SUSTAINED" | "RAMP_UP" | "SPIKE";
/** The spec lists ABORTED; the README mentions CANCELLED. Both are handled. */
export type TestStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "ABORTED" | "CANCELLED";

export type TestSample = {
  id?: string;
  timestamp: string;
  rps: number;
  activeVUs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorCount: number;
  statusCodes: Record<string, number>;
};

export type Bottleneck = "RATE_LIMIT_429" | "LATENCY_CLIFF" | "SERVER_ERROR_5XX" | "TIMEOUTS" | "NONE";

export type BreakingPointAnalysis = {
  kneeRps: number;
  failureRps: number;
  sustainableRps: number;
  bottleneck: Bottleneck;
  verdict: string;
};

export type TestRun = {
  id: string;
  projectId: string;
  name: string;
  profile: TestProfile;
  status: TestStatus;
  targetUrl: string;
  method: string;
  concurrency: number;
  durationSec: number;
  totalRequests: number;
  avgRps: number;
  peakRps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  statusCodes: Record<string, number>;
  breakingPoint?: BreakingPointAnalysis | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
  samples?: TestSample[];
  project?: { id: string; name: string };
};

export type ComparisonSide = {
  id: string;
  name: string;
  avgRps: number;
  p95Ms: number;
  errorRate: number;
  peakRps: number;
};

export type ComparisonResult = {
  runA: ComparisonSide;
  runB: ComparisonSide;
  deltas: {
    avgRpsDeltaPct: number;
    p95LatencyDeltaPct: number;
    errorRateDelta: number;
    peakRpsDeltaPct: number;
    improved: boolean;
    summary: string;
  };
};

export type ApiKeyRow = { id: string; name: string; prefix: string; createdAt: string };

export type OrgDetail = Org & {
  memberships: Array<{ role: string; user: { name: string; email: string } }>;
  apiKeys: ApiKeyRow[];
};

export type StreamState = "idle" | "connecting" | "live" | "reconnecting" | "disconnected" | "completed";

export type DiscoveredMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type DiscoveredEndpoint = {
  path: string;
  method: DiscoveredMethod;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: "path" | "query" | "header" | "cookie";
    required?: boolean;
    description?: string;
    schemaType?: string;
  }>;
  requestBody?: {
    contentType?: string;
    example?: unknown;
  };
  isSafe: boolean;
  source: "openapi" | "swagger" | "crawler" | "probe" | "graphql" | "sitemap";
  statusCode?: number;
};

export type DiscoveryResult = {
  baseUrl: string;
  source: "openapi" | "swagger" | "crawler" | "probe" | "graphql" | "mixed";
  specUrl?: string;
  title?: string;
  version?: string;
  endpoints: DiscoveredEndpoint[];
  probedCount: number;
  scanDurationMs: number;
};
