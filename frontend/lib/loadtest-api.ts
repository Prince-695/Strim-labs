import { api } from "./api-client"

export type LoadTestModel = "open" | "closed"
export type LoadTestProfile = "sustained" | "ramp" | "spike" | "step"
export type LoadTestStatus = "queued" | "running" | "completed" | "failed" | "stopped"

export interface TargetItem {
  endpoint_id?: string
  method: string
  path: string
  headers?: Record<string, string>
  body?: string
  weight?: number
}

export interface SpikeConfig {
  spike_rate: number
  spike_duration_seconds: number
  spike_start_second: number
}

export interface StepConfig {
  step_rate: number
  step_duration_seconds: number
  total_steps: number
}

export interface CapacityThresholds {
  max_p95_ms?: number
  max_error_rate?: number
}

export interface CreateLoadTestPayload {
  name: string
  model: LoadTestModel
  profile: LoadTestProfile
  targets: TargetItem[]
  all_endpoints?: boolean
  safe_only?: boolean
  start_rate: number
  peak_rate: number
  ramp_up_seconds?: number
  duration_seconds: number
  max_virtual_users: number
  total_requests?: number
  timeout_ms: number
  think_time_ms?: number
  spike?: SpikeConfig
  step?: StepConfig
  capacity_thresholds?: CapacityThresholds
  start_now?: boolean
}

export interface BottleneckInsight {
  method: string
  path: string
  broke_at_second?: number
  broke_at_rps: number
  p95_latency_ms: number
  error_rate: number
  reason?: string
}

export interface LiveRequestLog {
  time: string
  method: string
  path: string
  status_code: number
  latency_ms: number
  bytes: number
  error?: string
  is_error: boolean
}

export interface LiveEndpointHealth {
  method: string
  path: string
  total_requests: number
  current_rps: number
  p95_latency_ms: number
  error_rate: number
  status: "healthy" | "degraded" | "failing" | string
  first_broke_at_rps?: number
  first_broke_reason?: string
}

export interface LoadTestSummary {
  total_requests: number
  achieved_avg_rps: number
  peak_achieved_rps: number
  p50_ms: number
  p90_ms: number
  p95_ms: number
  p99_ms: number
  error_count: number
  error_rate: number
  status_codes: Record<string, number>
  duration_seconds: number
  first_bottleneck?: BottleneckInsight
}

export interface LoadTestResultsResponse {
  summary: LoadTestSummary
  per_endpoint?: {
    method: string
    path: string
    requests: number
    error_rate: number
    latency_ms: {
      p50: number
      p90: number
      p95: number
      p99: number
      avg: number
      min: number
      max: number
    }
  }[]
  latency_distribution?: { le_ms: number; count: number }[]
}

export interface LoadTestItem {
  id: string
  org_id: string
  project_id: string
  name: string
  model: LoadTestModel
  profile: LoadTestProfile
  status: LoadTestStatus
  started_at?: string
  finished_at?: string
  error_message?: string
  created_at: string
  config: {
    duration_seconds: number
    max_virtual_users: number
    peak_rate: number
    start_rate: number
    targets: TargetItem[]
  }
  summary?: LoadTestSummary
}

export interface TimeseriesPoint {
  t: number
  offered_rps: number
  achieved_rps: number
  p50: number
  p95: number
  p99: number
  errors: number
  active: number
}

export interface CapacityReport {
  id: string
  load_test_id: string
  project_id: string
  sustainable_rps: number
  breaking_point_rps?: number
  breaking_reason?: string
  baseline_p95_ms: number
  confidence: string
  note: string
  created_at: string
}

export interface CompareSummary {
  id: string
  name: string
  avg_rps: number
  peak_rps: number
  p95_ms: number
  error_rate: number
  sustainable_rps?: number
}

export interface CompareDelta {
  test_id: string
  avg_rps_pct: number
  peak_rps_pct: number
  p95_pct: number
  error_rate_pct: number
  verdict: "improved" | "regressed" | "unchanged"
}

export interface CompareOverlayPoint {
  t: number
  offered_rps: number
  achieved_rps: number
  p95: number
  errors: number
}

export interface CompareResponse {
  baseline_id: string
  tests: CompareSummary[]
  deltas: CompareDelta[]
  overlay: {
    step: string
    series: {
      test_id: string
      name: string
      points: CompareOverlayPoint[]
    }[]
  }
}

export const loadtestApi = {
  create: async (orgId: string, projectId: string, payload: CreateLoadTestPayload) => {
    return api.post<LoadTestItem>(`/organizations/${orgId}/projects/${projectId}/load-tests`, payload)
  },

  list: async (orgId: string, projectId: string) => {
    return api.get<LoadTestItem[]>(`/organizations/${orgId}/projects/${projectId}/load-tests`)
  },

  get: async (orgId: string, projectId: string, testId: string) => {
    return api.get<LoadTestItem>(`/organizations/${orgId}/projects/${projectId}/load-tests/${testId}`)
  },

  stop: async (orgId: string, projectId: string, testId: string) => {
    return api.post<{ message: string }>(`/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/stop`)
  },

  rerun: async (orgId: string, projectId: string, testId: string) => {
    return api.post<LoadTestItem>(`/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/rerun`)
  },

  delete: async (orgId: string, projectId: string, testId: string) => {
    return api.delete<{ message: string }>(`/organizations/${orgId}/projects/${projectId}/load-tests/${testId}`)
  },

  getResults: async (orgId: string, projectId: string, testId: string) => {
    return api.get<LoadTestResultsResponse>(`/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/results`)
  },

  getTimeseries: async (orgId: string, projectId: string, testId: string) => {
    return api.get<{ step: string; points: TimeseriesPoint[] }>(
      `/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/timeseries`
    )
  },

  getCapacity: async (orgId: string, projectId: string, testId: string) => {
    return api.get<CapacityReport>(`/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/capacity`)
  },

  recomputeCapacity: async (
    orgId: string,
    projectId: string,
    testId: string,
    payload: { thresholds?: CapacityThresholds; save?: boolean }
  ) => {
    return api.post<CapacityReport>(
      `/organizations/${orgId}/projects/${projectId}/load-tests/${testId}/capacity/recompute`,
      payload
    )
  },

  compare: async (orgId: string, projectId: string, payload: { test_ids: string[]; baseline_id?: string }) => {
    return api.post<CompareResponse>(`/organizations/${orgId}/projects/${projectId}/load-tests/compare`, payload)
  },
}
