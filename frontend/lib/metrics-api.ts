import { api } from "./api-client"

export interface StatusCodeCount {
  status: number
  count: number
}

export interface StatusCodesResponse {
  classes: Record<string, number> // e.g. { "2xx": 1500, "3xx": 12, "4xx": 45, "5xx": 2 }
  codes: StatusCodeCount[]
}

export interface MetricsOverview {
  total_requests: number
  average_rps: number
  peak_rps: number
  p50_ms: number
  p90_ms: number
  p95_ms: number
  p99_ms: number
  error_rate: number
  error_count: number
  period: string
}

export interface TimeseriesPoint {
  timestamp: string
  value: number | null
}

export interface TimeseriesSeries {
  key: string
  points: TimeseriesPoint[]
}

export interface MetricTimeseriesResponse {
  metric: string
  unit: string
  step: string
  series: TimeseriesSeries[]
}

export interface EndpointMetricItem {
  endpoint_id: string
  method: string
  path_template: string
  service: string
  requests: number
  rps: number
  p50: number
  p95: number
  p99: number
  error_rate: number
  health: string
}

export const metricsApi = {
  getOverview: async (orgId: string, projectId: string, range = "1h") => {
    return api.get<MetricsOverview>(
      `/organizations/${orgId}/projects/${projectId}/metrics/overview?range=${range}`
    )
  },

  getStatusCodes: async (orgId: string, projectId: string, range = "1h") => {
    return api.get<StatusCodesResponse>(
      `/organizations/${orgId}/projects/${projectId}/metrics/status-codes?range=${range}`
    )
  },

  getTimeseries: async (
    orgId: string,
    projectId: string,
    metric = "rps",
    range = "1h"
  ) => {
    return api.get<MetricTimeseriesResponse>(
      `/organizations/${orgId}/projects/${projectId}/metrics/timeseries?metric=${metric}&range=${range}`
    )
  },

  getEndpoints: async (orgId: string, projectId: string, range = "1h") => {
    return api.get<EndpointMetricItem[]>(
      `/organizations/${orgId}/projects/${projectId}/metrics/endpoints?range=${range}`
    )
  },
}
