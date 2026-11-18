import { api } from "./api-client"

export interface EndpointStats {
  requests: number
  rps: number
  p95_ms: number
  error_rate: number
}

export interface EndpointItem {
  id: string
  method: string
  path_template: string
  service: string
  tags: string[]
  status: "active" | "ignored"
  sources: string[]
  note?: string
  first_seen: string
  last_seen: string
  stats_1h: EndpointStats
}

export interface ListEndpointsParams {
  q?: string
  method?: string
  tag?: string
  status?: string
}

export interface ImportOpenAPIPayload {
  url: string
}

export interface DiscoveryRun {
  id: string
  project_id: string
  source: string
  status: string
  found: number
  created: number
  updated: number
  error?: string
  started_at: string
  finished_at?: string
}

export const endpointApi = {
  list: async (orgId: string, projectId: string, params?: ListEndpointsParams) => {
    return api.get<EndpointItem[]>(`/organizations/${orgId}/projects/${projectId}/endpoints`, {
      params: params as Record<string, string | number | boolean>,
    })
  },

  get: async (orgId: string, projectId: string, endpointId: string) => {
    return api.get<EndpointItem>(`/organizations/${orgId}/projects/${projectId}/endpoints/${endpointId}`)
  },

  importOpenAPI: async (orgId: string, projectId: string, payload: ImportOpenAPIPayload) => {
    return api.post<DiscoveryRun>(`/organizations/${orgId}/projects/${projectId}/discovery/openapi`, payload)
  },

  patch: async (orgId: string, projectId: string, endpointId: string, payload: { status?: string; tags?: string[]; note?: string }) => {
    return api.patch<EndpointItem>(`/organizations/${orgId}/projects/${projectId}/endpoints/${endpointId}`, payload)
  },
}
