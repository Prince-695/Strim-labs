// ─── Shared Zod Schemas for OpenAPI generation ───────────────────────────────
// Single source of truth: schemas generate both runtime validation and OpenAPI docs

import { z } from "@hono/zod-openapi";

// ─── Primitives ───────────────────────────────────────────────────────────────

export const CuidSchema = z.string().cuid().openapi({ example: "clx1234567890abcdef" });
export const EmailSchema = z.string().email().min(5).max(254).openapi({ example: "dev@acme.com" });
export const PasswordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, "Must contain uppercase")
  .regex(/[0-9]/, "Must contain number")
  .openapi({ example: "StrongPass1" });

export const DateTimeSchema = z.string().datetime().openapi({ example: "2026-10-26T12:00:00.000Z" });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export const PaginatedMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

// ─── Standard Error ───────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  code: z.string().openapi({ example: "VALIDATION_ERROR" }),
  message: z.string().openapi({ example: "The request is invalid." }),
  details: z.record(z.any()).optional(),
  requestId: z.string().optional(),
}).openapi("ApiError");

export const ErrorResponseSchema = ApiErrorSchema;

export const SuccessResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().optional().openapi({ example: "Operation completed successfully" }),
}).openapi("SuccessResponse");

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const SignUpSchema = z.object({
  name: z.string().min(2).max(100).openapi({ example: "Priya Sharma" }),
  email: EmailSchema,
  password: PasswordSchema,
  organizationName: z.string().min(2).max(80).openapi({ example: "Acme Corp" }),
});

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).openapi({ example: "StrongPass1" }),
  rememberMe: z.boolean().default(false),
});

export const ForgotPasswordSchema = z.object({ email: EmailSchema });

export const ResetPasswordSchema = z.object({
  token: z.string().min(32).openapi({ example: "abc123..." }),
  newPassword: PasswordSchema,
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: PasswordSchema,
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(32),
});

export const UserSchema = z.object({
  id: CuidSchema,
  email: EmailSchema,
  emailVerified: z.boolean(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  timezone: z.string(),
  locale: z.string(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("User");

export const SessionInfoSchema = z.object({
  id: CuidSchema,
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  lastActiveAt: DateTimeSchema,
  expiresAt: DateTimeSchema,
  isCurrent: z.boolean(),
}).openapi("SessionInfo");

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().openapi({ example: 604800 }),
  user: UserSchema,
}).openapi("AuthResponse");

// ─── User Preferences ────────────────────────────────────────────────────────

export const UserPreferencesSchema = z.object({
  timezone: z.string().default("UTC").openapi({ example: "Asia/Kolkata" }),
  locale: z.string().default("en"),
  theme: z.enum(["dark", "light", "system"]).default("dark"),
  notifyEmail: z.boolean().default(true),
  notifySlack: z.boolean().default(false),
}).openapi("UserPreferences");

// ─── Organizations ────────────────────────────────────────────────────────────

export const RoleSchema = z.enum(["OWNER", "ADMIN", "ENGINEER", "DEVELOPER", "VIEWER"]);

export const CreateOrgSchema = z.object({
  name: z.string().min(2).max(80).openapi({ example: "Acme Corp" }),
  description: z.string().max(500).optional(),
  website: z.string().url().optional(),
});

export const UpdateOrgSchema = CreateOrgSchema.partial();

export const OrgSchema = z.object({
  id: CuidSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  website: z.string().url().nullable(),
  plan: z.string(),
  memberCount: z.number(),
  projectCount: z.number(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Organization");

export const MemberSchema = z.object({
  userId: CuidSchema,
  name: z.string(),
  email: EmailSchema,
  avatarUrl: z.string().url().nullable(),
  role: RoleSchema,
  joinedAt: DateTimeSchema,
}).openapi("Member");

export const InvitationSchema = z.object({
  id: CuidSchema,
  email: EmailSchema,
  role: RoleSchema,
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"]),
  expiresAt: DateTimeSchema,
  createdAt: DateTimeSchema,
}).openapi("Invitation");

export const CreateInvitationSchema = z.object({
  email: EmailSchema,
  role: RoleSchema,
});

export const AcceptInvitationSchema = z.object({
  token: z.string().min(10).openapi({ example: "inv_abc123..." }),
});

export const UpdateMemberSchema = z.object({
  role: RoleSchema,
});

export const TransferOwnershipSchema = z.object({
  newOwnerId: CuidSchema,
});

// ─── Projects ─────────────────────────────────────────────────────────────────

export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(80).openapi({ example: "Checkout API" }),
  description: z.string().max(500).optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export const ProjectStatusSchema = z.enum(["PENDING_SDK", "ACTIVE", "DEGRADED", "INCIDENT", "ARCHIVED"]);

export const ProjectSchema = z.object({
  id: CuidSchema,
  organizationId: CuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  ingestKey: z.string().openapi({ example: "strim_live_..." }),
  serviceCount: z.number(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Project");

// ─── Services ─────────────────────────────────────────────────────────────────

export const CreateServiceSchema = z.object({
  name: z.string().min(2).max(80).openapi({ example: "Payment Gateway" }),
  description: z.string().max(500).optional(),
  baseUrl: z.string().url().openapi({ example: "https://api.acme.com" }),
  framework: z.enum(["hono", "express", "fastify", "nextjs", "django", "fastapi", "spring", "other"]).optional(),
  language: z.enum(["typescript", "javascript", "python", "go", "java", "rust", "other"]).optional(),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  tags: z.array(z.string()).default([]),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const ServiceStatusSchema = z.enum(["PENDING", "HEALTHY", "DEGRADED", "DOWN", "UNKNOWN"]);

export const ServiceSchema = z.object({
  id: CuidSchema,
  projectId: CuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  baseUrl: z.string(),
  status: ServiceStatusSchema,
  framework: z.string().nullable(),
  language: z.string().nullable(),
  environment: z.string(),
  tags: z.array(z.string()),
  endpointCount: z.number().optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Service");

export const DiscoveryRunSchema = z.object({
  id: CuidSchema,
  serviceId: CuidSchema,
  status: z.enum(["RUNNING", "COMPLETED", "FAILED"]),
  source: z.enum(["OPENAPI_PROBE", "CRAWLER", "MANUAL_IMPORT", "SDK_TELEMETRY"]),
  specUrl: z.string().url().nullable(),
  endpointsFound: z.number(),
  error: z.string().nullable(),
  startedAt: DateTimeSchema,
  completedAt: DateTimeSchema.nullable(),
}).openapi("DiscoveryRun");

export const CreateDiscoveryRunSchema = z.object({
  source: z.enum(["OPENAPI_PROBE", "CRAWLER", "MANUAL_IMPORT"]).default("OPENAPI_PROBE"),
  specUrl: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
});

export const SpecificationSchema = z.object({
  id: CuidSchema,
  serviceId: CuidSchema,
  version: z.string().nullable(),
  title: z.string().nullable(),
  format: z.enum(["openapi_3_1", "openapi_3_0", "swagger_2"]),
  specUrl: z.string().url().nullable(),
  createdAt: DateTimeSchema,
}).openapi("Specification");

export const ImportSpecSchema = z.object({
  format: z.enum(["openapi_3_1", "openapi_3_0", "swagger_2"]).default("openapi_3_1"),
  specUrl: z.string().url().optional(),
  rawSpec: z.record(z.any()).optional(),
}).openapi("ImportSpec");

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export const EndpointSchema = z.object({
  id: CuidSchema,
  serviceId: CuidSchema,
  path: z.string().openapi({ example: "/api/v1/orders" }),
  method: HttpMethodSchema,
  summary: z.string().nullable(),
  description: z.string().nullable(),
  operationId: z.string().nullable(),
  tags: z.array(z.string()),
  deprecated: z.boolean(),
  isSafe: z.boolean(),
  source: z.string(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Endpoint");

export const CreateEndpointSchema = z.object({
  path: z.string().startsWith("/").openapi({ example: "/api/orders" }),
  method: HttpMethodSchema,
  summary: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  operationId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  deprecated: z.boolean().default(false),
  parameters: z.record(z.any()).optional(),
  requestBody: z.record(z.any()).optional(),
  responses: z.record(z.any()).optional(),
}).openapi("CreateEndpoint");

export const UpdateEndpointSchema = z.object({
  path: z.string().startsWith("/").optional(),
  method: HttpMethodSchema.optional(),
  summary: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  operationId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  deprecated: z.boolean().optional(),
  parameters: z.record(z.any()).optional(),
  requestBody: z.record(z.any()).optional(),
  responses: z.record(z.any()).optional(),
}).openapi("UpdateEndpoint");

export const EndpointChangeSchema = z.object({
  endpointId: CuidSchema,
  path: z.string(),
  method: z.string(),
  changeType: z.enum(["ADDED", "REMOVED", "MODIFIED", "DEPRECATED"]),
  diff: z.record(z.any()).optional(),
  detectedAt: DateTimeSchema,
}).openapi("EndpointChange");

// ─── Ingest ───────────────────────────────────────────────────────────────────

export const IngestRegisterSchema = z.object({
  serviceName: z.string().min(2).max(80),
  serviceVersion: z.string().optional(),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  framework: z.string().optional(),
  sdkVersion: z.string().optional(),
});

export const IngestHeartbeatSchema = z.object({
  timestamp: z.number().int().positive(),
  pid: z.number().optional(),
  uptime: z.number().optional(),
  memoryMb: z.number().optional(),
  cpuPct: z.number().min(0).max(100).optional(),
});

export const IngestRouteManifestSchema = z.object({
  routes: z.array(z.object({
    path: z.string(),
    method: HttpMethodSchema,
    summary: z.string().optional(),
  })).min(1).max(500),
});

export const TelemetryEventSchema = z.object({
  timestamp: z.number().int().positive(),
  method: z.string().default("GET"),
  path: z.string().default("/"),
  statusCode: z.number().int().min(100).max(599).default(200),
  durationMs: z.number().min(0).default(0),
  userAgent: z.string().optional(),
  traceId: z.string().optional(),
});

export const IngestMetricsSchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(5000),
  sentAt: z.number().int().positive(),
});

export const IngestEventsSchema = z.object({
  events: z.array(z.object({
    type: z.string(),
    timestamp: z.number().int(),
    payload: z.record(z.any()),
  })).min(1).max(1000),
});

export const IngestSpanSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  operationName: z.string(),
  service: z.string(),
  startTimeUs: z.number().int(),
  durationUs: z.number().int(),
  status: z.enum(["OK", "ERROR", "UNSET"]),
  attributes: z.record(z.any()).optional(),
});

export const IngestTracesSchema = z.object({
  spans: z.array(IngestSpanSchema).min(1).max(1000),
});

export const IngestLogsSchema = z.object({
  logs: z.array(z.object({
    timestamp: z.number().int(),
    level: z.enum(["debug", "info", "warn", "error", "fatal"]),
    message: z.string(),
    attributes: z.record(z.any()).optional(),
    traceId: z.string().optional(),
  })).min(1).max(2000),
});

// ─── Monitoring & Observability ───────────────────────────────────────────────

export const TimeseriesPointSchema = z.object({
  timestamp: DateTimeSchema,
  value: z.number(),
}).openapi("TimeseriesPoint");

export const MetricsSummarySchema = z.object({
  rps: z.number(),
  p50Ms: z.number(),
  p95Ms: z.number(),
  p99Ms: z.number(),
  errorRate: z.number(),
  totalRequests: z.number(),
  successRate: z.number(),
}).openapi("MetricsSummary");

export const ServiceHealthSchema = z.object({
  serviceId: CuidSchema,
  status: ServiceStatusSchema,
  score: z.number().min(0).max(100),
  breakdown: z.object({
    availability: z.number(),
    latency: z.number(),
    errors: z.number(),
    saturation: z.number(),
  }),
  metrics: MetricsSummarySchema,
  checkedAt: DateTimeSchema,
}).openapi("ServiceHealth");

export const TimeseriesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  granularity: z.enum(["1m", "5m", "15m", "1h", "1d"]).default("5m"),
  serviceId: z.string().optional(),
});

export const TraceSchema = z.object({
  traceId: z.string(),
  spans: z.array(IngestSpanSchema),
  duration: z.number(),
  service: z.string(),
  hasErrors: z.boolean(),
  startedAt: DateTimeSchema,
}).openapi("Trace");

// ─── Dashboards ───────────────────────────────────────────────────────────────

export const PanelTypeSchema = z.enum(["TIMESERIES", "STAT", "TABLE", "BAR_CHART", "GAUGE", "TEXT", "HEATMAP"]);

export const PanelLayoutSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(24),
  h: z.number().int().min(1).max(24),
});

export const CreatePanelSchema = z.object({
  type: PanelTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  query: z.record(z.any()),
  layout: PanelLayoutSchema,
  options: z.record(z.any()).optional(),
});

export const UpdatePanelSchema = CreatePanelSchema.partial();

export const PanelSchema = z.object({
  id: CuidSchema,
  dashboardId: CuidSchema,
  type: PanelTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  query: z.record(z.any()),
  layout: PanelLayoutSchema,
  options: z.record(z.any()).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Panel");

export const CreateDashboardSchema = z.object({
  name: z.string().min(1).max(100).openapi({ example: "Production Overview" }),
  description: z.string().max(500).optional(),
});

export const UpdateDashboardSchema = CreateDashboardSchema.partial();

export const DashboardSchema = z.object({
  id: CuidSchema,
  projectId: CuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  panelCount: z.number(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Dashboard");

export const PreviewQuerySchema = z.object({
  query: z.record(z.any()),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const AlertSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
export const AlertConditionTypeSchema = z.enum(["THRESHOLD", "ANOMALY", "ERROR_RATE", "LATENCY", "AVAILABILITY"]);

export const CreateAlertRuleSchema = z.object({
  name: z.string().min(2).max(100).openapi({ example: "High error rate" }),
  description: z.string().max(500).optional(),
  severity: AlertSeveritySchema.default("WARNING"),
  condition: AlertConditionTypeSchema,
  threshold: z.number().optional(),
  window: z.number().int().min(10).max(3600).default(60).openapi({ description: "Evaluation window in seconds" }),
  channelIds: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

export const UpdateAlertRuleSchema = CreateAlertRuleSchema.partial();

export const AlertRuleSchema = z.object({
  id: CuidSchema,
  projectId: CuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  severity: AlertSeveritySchema,
  condition: AlertConditionTypeSchema,
  threshold: z.number().nullable(),
  window: z.number(),
  channelIds: z.array(z.string()),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("AlertRule");

export const IncidentStatusSchema = z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]);

export const IncidentSchema = z.object({
  id: CuidSchema,
  projectId: CuidSchema,
  ruleId: CuidSchema.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  severity: AlertSeveritySchema,
  status: IncidentStatusSchema,
  openedAt: DateTimeSchema,
  acknowledgedAt: DateTimeSchema.nullable(),
  resolvedAt: DateTimeSchema.nullable(),
}).openapi("Incident");

export const NotificationChannelTypeSchema = z.enum(["EMAIL", "SLACK", "PAGERDUTY", "WEBHOOK", "TEAMS"]);

export const CreateNotificationChannelSchema = z.object({
  name: z.string().min(2).max(100),
  type: NotificationChannelTypeSchema,
  config: z.record(z.any()).openapi({ description: "Channel-specific configuration" }),
  enabled: z.boolean().default(true),
});

export const UpdateNotificationChannelSchema = CreateNotificationChannelSchema.partial();

export const NotificationChannelSchema = z.object({
  id: CuidSchema,
  projectId: CuidSchema,
  name: z.string(),
  type: NotificationChannelTypeSchema,
  config: z.record(z.any()),
  enabled: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("NotificationChannel");

// ─── Load Testing ─────────────────────────────────────────────────────────────

export const RunProfileSchema = z.enum(["SUSTAINED", "RAMP_UP", "SPIKE", "BREAKING_HUNT"]);
export const RunStatusSchema = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "ABORTED"]);

export const CreateTestRunSchema = z.object({
  name: z.string().min(2).max(100).openapi({ example: "Breaking Point Hunt — v2.3.1" }),
  description: z.string().max(500).optional(),
  targetUrl: z.string().url().openapi({ example: "https://api.acme.com/checkout" }),
  method: HttpMethodSchema.default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.record(z.any()).optional(),
  profile: RunProfileSchema.default("RAMP_UP"),
  concurrency: z.number().int().min(1).max(1000).default(50),
  durationSec: z.number().int().min(5).max(300).default(30),
  rampUpSec: z.number().int().min(0).max(120).default(10),
});

export const UpdateTestRunSchema = CreateTestRunSchema.omit({ targetUrl: true, method: true }).partial();

export const TestRunSchema = z.object({
  id: CuidSchema,
  projectId: CuidSchema,
  userId: CuidSchema.nullable(),
  name: z.string(),
  description: z.string().nullable(),
  profile: RunProfileSchema,
  status: RunStatusSchema,
  targetUrl: z.string(),
  method: HttpMethodSchema,
  concurrency: z.number(),
  durationSec: z.number(),
  totalRequests: z.number(),
  avgRps: z.number(),
  peakRps: z.number(),
  p50Ms: z.number(),
  p95Ms: z.number(),
  p99Ms: z.number(),
  errorRate: z.number(),
  startedAt: DateTimeSchema.nullable(),
  completedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("TestRun");

export const TestSampleSchema = z.object({
  id: CuidSchema.optional(),
  timestamp: DateTimeSchema,
  rps: z.number(),
  activeVUs: z.number(),
  p50Ms: z.number(),
  p95Ms: z.number(),
  p99Ms: z.number(),
  errorCount: z.number(),
  statusCodes: z.record(z.number()),
}).openapi("TestSample");

export const BreakingPointSchema = z.object({
  kneeRps: z.number(),
  failureRps: z.number(),
  sustainableRps: z.number(),
  bottleneck: z.enum(["RATE_LIMIT_429", "LATENCY_CLIFF", "SERVER_ERROR_5XX", "TIMEOUTS", "NONE"]),
  verdict: z.string(),
  zone: z.enum(["SAFE", "SATURATION_KNEE", "BREAKING_CLIFF"]),
}).openapi("BreakingPoint");

export const TestResultsSchema = z.object({
  runId: CuidSchema,
  status: RunStatusSchema,
  summary: MetricsSummarySchema,
  statusCodes: z.record(z.number()),
  breakingPoint: BreakingPointSchema.nullable(),
  diagnostics: z.string().nullable(),
}).openapi("TestResults");

export const TestErrorsSchema = z.object({
  runId: CuidSchema,
  totalErrors: z.number(),
  errorRate: z.number(),
  statusCodes: z.record(z.number()),
  recentErrors: z.array(
    z.object({
      timestamp: DateTimeSchema,
      statusCode: z.number(),
      count: z.number(),
    })
  ),
}).openapi("TestErrors");

export const TestResourcesSchema = z.object({
  runId: CuidSchema,
  samples: z.array(
    z.object({
      timestamp: DateTimeSchema,
      activeVUs: z.number(),
      rps: z.number(),
      cpuPercent: z.number().optional(),
      memoryMb: z.number().optional(),
    })
  ),
}).openapi("TestResources");

export const TestArtifactsSchema = z.object({
  runId: CuidSchema,
  logs: z.array(z.string()),
  config: z.record(z.any()),
  exportedAt: DateTimeSchema,
}).openapi("TestArtifacts");

export const ComparisonSchema = z.object({
  id: CuidSchema,
  baselineId: CuidSchema,
  candidateId: CuidSchema,
  verdict: z.enum(["IMPROVED", "REGRESSED", "STABLE", "INCONCLUSIVE"]).nullable(),
  result: z.object({
    avgRpsDelta: z.number(),
    p95LatencyDelta: z.number(),
    errorRateDelta: z.number(),
    summary: z.string(),
  }).nullable(),
  createdAt: DateTimeSchema,
}).openapi("TestComparison");

export const CreateComparisonSchema = z.object({
  candidateId: CuidSchema.openapi({ description: "Test run to compare against the baseline" }),
});

// ─── Diagnostics & Regression ─────────────────────────────────────────────────

export const CreateDiagnosticSchema = z.object({
  targetUrl: z.string().url(),
  headers: z.record(z.string()).optional(),
  type: z.enum(["SMOKE", "LATENCY", "SATURATION", "FULL"]).default("SMOKE"),
});

export const DiagnosticSchema = z.object({
  id: CuidSchema,
  projectId: CuidSchema,
  type: z.string(),
  status: RunStatusSchema,
  targetUrl: z.string(),
  result: z.record(z.any()).nullable(),
  createdAt: DateTimeSchema,
}).openapi("Diagnostic");

export const BottleneckSchema = z.object({
  serviceId: CuidSchema,
  type: z.string(),
  severity: AlertSeveritySchema,
  description: z.string(),
  endpoint: z.string().nullable(),
  metrics: z.record(z.number()),
  detectedAt: DateTimeSchema,
}).openapi("Bottleneck");

export const RegressionSchema = z.object({
  serviceId: CuidSchema,
  endpoint: z.string(),
  metric: z.string(),
  baselineValue: z.number(),
  currentValue: z.number(),
  deltaPct: z.number(),
  severity: AlertSeveritySchema,
  detectedAt: DateTimeSchema,
}).openapi("Regression");

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const ApiKeyScopeSchema = z.enum([
  "telemetry:write",
  "config:read",
  "config:write",
  "load-test:write",
  "alerts:write",
  "read:all",
]);

export const CreateApiKeySchema = z.object({
  name: z.string().min(2).max(100).openapi({ example: "CI/CD Deploy Key" }),
  scopes: z.array(ApiKeyScopeSchema).min(1),
  expiresAt: z.string().datetime().optional(),
});

export const ApiKeySchema = z.object({
  id: CuidSchema,
  name: z.string(),
  type: z.enum(["PERSONAL", "PROJECT_INGEST", "ORG_SERVICE"]),
  prefix: z.string().openapi({ example: "sk_live_abcd" }),
  scopes: z.array(z.string()),
  lastUsedAt: DateTimeSchema.nullable(),
  expiresAt: DateTimeSchema.nullable(),
  revokedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
}).openapi("ApiKey");

export const CreatedApiKeySchema = ApiKeySchema.extend({
  key: z.string().openapi({ description: "Full key — shown ONCE, store it securely", example: "sk_live_abcd1234..." }),
}).openapi("CreatedApiKey");

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export const WebhookEventTypeSchema = z.enum([
  "INCIDENT_CREATED",
  "INCIDENT_RESOLVED",
  "ALERT_FIRED",
  "LOAD_TEST_COMPLETED",
  "SERVICE_DOWN",
  "SERVICE_RECOVERED",
  "PROJECT_CREATED",
  "MEMBER_ADDED",
  "MEMBER_REMOVED",
]);

export const CreateWebhookSchema = z.object({
  name: z.string().min(2).max(100).openapi({ example: "Prod Incident Hook" }),
  url: z.string().url().openapi({ example: "https://hooks.slack.com/services/..." }),
  events: z.array(WebhookEventTypeSchema).min(1),
  enabled: z.boolean().default(true),
});

export const UpdateWebhookSchema = CreateWebhookSchema.partial();

export const WebhookSchema = z.object({
  id: CuidSchema,
  organizationId: CuidSchema,
  name: z.string(),
  url: z.string(),
  events: z.array(WebhookEventTypeSchema),
  enabled: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Webhook");

export const WebhookDeliverySchema = z.object({
  id: CuidSchema,
  webhookId: CuidSchema,
  eventType: WebhookEventTypeSchema,
  payload: z.record(z.any()),
  statusCode: z.number().nullable(),
  success: z.boolean(),
  attemptedAt: DateTimeSchema,
  duration: z.number().nullable(),
}).openapi("WebhookDelivery");

// ─── Integrations ─────────────────────────────────────────────────────────────

export const IntegrationTypeSchema = z.enum([
  "GITHUB", "GITLAB", "SLACK", "PAGERDUTY", "DATADOG", "GRAFANA", "JIRA",
]);

export const CreateIntegrationSchema = z.object({
  type: IntegrationTypeSchema,
  name: z.string().min(2).max(100).openapi({ example: "GitHub Prod" }),
  config: z.record(z.any()).openapi({ description: "Integration-specific credentials and config" }),
});

export const IntegrationSchema = z.object({
  id: CuidSchema,
  organizationId: CuidSchema,
  type: IntegrationTypeSchema,
  name: z.string(),
  enabled: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).openapi("Integration");

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const AuditLogSchema = z.object({
  id: CuidSchema,
  organizationId: CuidSchema,
  userId: CuidSchema.nullable(),
  userName: z.string().nullable(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.any()).nullable(),
  ipAddress: z.string().nullable(),
  createdAt: DateTimeSchema,
}).openapi("AuditLog");

export const AuditLogQuerySchema = PaginationQuerySchema.extend({
  action: z.string().optional(),
  userId: z.string().optional(),
  resourceType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── Usage & Quotas ───────────────────────────────────────────────────────────

export const UsageSchema = z.object({
  plan: z.string(),
  organizations: z.object({ used: z.number(), limit: z.number() }),
  projects: z.object({ used: z.number(), limit: z.number() }),
  ingestEventsPerMonth: z.object({ used: z.number(), limit: z.number() }),
  loadTestMinutesPerMonth: z.object({ used: z.number(), limit: z.number() }),
  apiKeysPerOrg: z.object({ used: z.number(), limit: z.number() }),
  retentionDays: z.number(),
  resetAt: DateTimeSchema,
}).openapi("Usage");

// ─── Health ───────────────────────────────────────────────────────────────────

export const HealthLiveSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  timestamp: DateTimeSchema,
}).openapi("HealthLive");

export const HealthReadySchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["ok", "error"]),
  timestamp: DateTimeSchema,
}).openapi("HealthReady");

export const DependenciesHealthSchema = z.object({
  database: z.object({ status: z.string(), latencyMs: z.number() }),
  redis: z.object({ status: z.string(), latencyMs: z.number() }).optional(),
}).openapi("DependenciesHealth");
