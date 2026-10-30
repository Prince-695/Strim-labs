export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
    session: () => ["auth", "session"] as const,
  },
  users: {
    me: () => ["users", "me"] as const,
    preferences: () => ["users", "preferences"] as const,
    sessions: () => ["users", "sessions"] as const,
    organizations: () => ["users", "organizations"] as const,
  },
  organizations: {
    all: () => ["organizations"] as const,
    detail: (orgId: string) => ["organizations", orgId] as const,
    members: (orgId: string) => ["organizations", orgId, "members"] as const,
    invitations: (orgId: string) => ["organizations", orgId, "invitations"] as const,
    usage: (orgId: string) => ["organizations", orgId, "usage"] as const,
    apiKeys: (orgId: string) => ["organizations", orgId, "api-keys"] as const,
    webhooks: (orgId: string) => ["organizations", orgId, "webhooks"] as const,
    webhookDeliveries: (orgId: string, webhookId: string) =>
      ["organizations", orgId, "webhooks", webhookId, "deliveries"] as const,
    integrations: (orgId: string) => ["organizations", orgId, "integrations"] as const,
    auditLogs: (orgId: string, filters?: Record<string, unknown>) =>
      ["organizations", orgId, "audit-logs", filters] as const,
  },
  projects: {
    all: (orgId: string) => ["organizations", orgId, "projects"] as const,
    detail: (orgId: string, projectId: string) => ["organizations", orgId, "projects", projectId] as const,
    usage: (orgId: string, projectId: string) => ["organizations", orgId, "projects", projectId, "usage"] as const,
    activity: (orgId: string, projectId: string) =>
      ["organizations", orgId, "projects", projectId, "activity"] as const,
  },
  services: {
    all: (orgId: string, projectId: string) =>
      ["organizations", orgId, "projects", projectId, "services"] as const,
    detail: (orgId: string, projectId: string, serviceId: string) =>
      ["organizations", orgId, "projects", projectId, "services", serviceId] as const,
    discoveryRuns: (orgId: string, projectId: string, serviceId: string) =>
      ["organizations", orgId, "projects", projectId, "services", serviceId, "discovery-runs"] as const,
    endpoints: (orgId: string, projectId: string, serviceId: string, filters?: Record<string, unknown>) =>
      ["organizations", orgId, "projects", projectId, "services", serviceId, "endpoints", filters] as const,
    endpointDetail: (orgId: string, projectId: string, serviceId: string, endpointId: string) =>
      ["organizations", orgId, "projects", projectId, "services", serviceId, "endpoints", endpointId] as const,
  },
  monitoring: {
    overview: (orgId: string, projectId: string) =>
      ["organizations", orgId, "projects", projectId, "monitoring", "overview"] as const,
    summary: (orgId: string, projectId: string, range?: string) =>
      ["organizations", orgId, "projects", projectId, "monitoring", "summary", range] as const,
    timeseries: (orgId: string, projectId: string, query?: Record<string, unknown>) =>
      ["organizations", orgId, "projects", projectId, "monitoring", "timeseries", query] as const,
    errors: (orgId: string, projectId: string, query?: Record<string, unknown>) =>
      ["organizations", orgId, "projects", projectId, "monitoring", "errors", query] as const,
    traces: (orgId: string, projectId: string, query?: Record<string, unknown>) =>
      ["organizations", orgId, "projects", projectId, "monitoring", "traces", query] as const,
    traceDetail: (orgId: string, projectId: string, traceId: string) =>
      ["organizations", orgId, "projects", projectId, "monitoring", "traces", traceId] as const,
    resources: (orgId: string, projectId: string, query?: Record<string, unknown>) =>
      ["organizations", orgId, "projects", projectId, "monitoring", "resources", query] as const,
  },
  dashboards: {
    all: (orgId: string, projectId: string) =>
      ["organizations", orgId, "projects", projectId, "dashboards"] as const,
    detail: (orgId: string, projectId: string, dashboardId: string) =>
      ["organizations", orgId, "projects", projectId, "dashboards", dashboardId] as const,
    panels: (orgId: string, projectId: string, dashboardId: string) =>
      ["organizations", orgId, "projects", projectId, "dashboards", dashboardId, "panels"] as const,
  },
  alerts: {
    rules: (orgId: string, projectId: string) =>
      ["organizations", orgId, "projects", projectId, "alerts", "rules"] as const,
    incidents: (orgId: string, projectId: string, status?: string) =>
      ["organizations", orgId, "projects", projectId, "alerts", "incidents", status] as const,
    channels: (orgId: string, projectId: string) =>
      ["organizations", orgId, "projects", projectId, "alerts", "channels"] as const,
  },
  loadTests: {
    all: (orgId: string, projectId: string, query?: Record<string, unknown>) =>
      ["organizations", orgId, "projects", projectId, "load-tests", query] as const,
    detail: (orgId: string, projectId: string, testId: string) =>
      ["organizations", orgId, "projects", projectId, "load-tests", testId] as const,
    results: (orgId: string, projectId: string, testId: string) =>
      ["organizations", orgId, "projects", projectId, "load-tests", testId, "results"] as const,
    timeline: (orgId: string, projectId: string, testId: string) =>
      ["organizations", orgId, "projects", projectId, "load-tests", testId, "timeline"] as const,
    errors: (orgId: string, projectId: string, testId: string) =>
      ["organizations", orgId, "projects", projectId, "load-tests", testId, "errors"] as const,
    resources: (orgId: string, projectId: string, testId: string) =>
      ["organizations", orgId, "projects", projectId, "load-tests", testId, "resources"] as const,
    diagnostics: (orgId: string, projectId: string, testId: string) =>
      ["organizations", orgId, "projects", projectId, "load-tests", testId, "diagnostics"] as const,
    artifacts: (orgId: string, projectId: string, testId: string) =>
      ["organizations", orgId, "projects", projectId, "load-tests", testId, "artifacts"] as const,
  },
  diagnostics: {
    all: (orgId: string, projectId: string, query?: Record<string, unknown>) =>
      ["organizations", orgId, "projects", projectId, "diagnostics", query] as const,
    detail: (orgId: string, projectId: string, diagnosticId: string) =>
      ["organizations", orgId, "projects", projectId, "diagnostics", diagnosticId] as const,
    bottlenecks: (orgId: string, projectId: string, serviceId: string) =>
      ["organizations", orgId, "projects", projectId, "diagnostics", "bottlenecks", serviceId] as const,
    regressions: (orgId: string, projectId: string, serviceId: string) =>
      ["organizations", orgId, "projects", projectId, "diagnostics", "regressions", serviceId] as const,
    comparison: (orgId: string, projectId: string, testId: string, comparisonId: string) =>
      ["organizations", orgId, "projects", projectId, "diagnostics", "comparisons", testId, comparisonId] as const,
  },
  platform: {
    healthLive: () => ["platform", "health", "live"] as const,
    healthReady: () => ["platform", "health", "ready"] as const,
    healthDependencies: () => ["platform", "health", "dependencies"] as const,
    usage: () => ["platform", "usage"] as const,
  },
};
