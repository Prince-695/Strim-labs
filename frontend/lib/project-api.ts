import { api } from "./api-client"

export type ProjectEnvironment = "development" | "staging" | "production"
export type VerificationStatus =
  "unverified" | "pending" | "verified" | "failed"
export type VerificationMethod = "dns" | "file"

export interface Project {
  id: string
  org_id: string
  name: string
  slug: string
  description?: string
  base_url: string
  environment: ProjectEnvironment
  verification_status: VerificationStatus
  verified_at?: string
  endpoint_count: number
  health?: string
  created_at: string
  updated_at: string
}

export interface ProjectDetail extends Project {
  stats_1h: {
    requests: number
    p95_ms: number
    error_rate: number
  }
  last_test?: {
    id: string
    status: string
  }
}

export interface CreateProjectPayload {
  name: string
  slug: string
  description?: string
  base_url: string
  environment: ProjectEnvironment
}

export interface UpdateProjectPayload {
  name?: string
  description?: string
  base_url?: string
  environment?: ProjectEnvironment
}

export interface DNSInstructions {
  type: string
  host: string
  value: string
}

export interface FileInstructions {
  url: string
  content: string
}

export interface VerificationResponse {
  status: VerificationStatus
  method: VerificationMethod
  token: string
  instructions: {
    dns: DNSInstructions
    file: FileInstructions
  }
  expires_at: string
}

export interface CheckVerificationResponse {
  status: VerificationStatus
  verified_at?: string
  reason?: string
}

export const projectApi = {
  list: async (orgId: string) => {
    return api.get<Project[]>(`/organizations/${orgId}/projects`)
  },

  get: async (orgId: string, projectId: string) => {
    return api.get<ProjectDetail>(
      `/organizations/${orgId}/projects/${projectId}`
    )
  },

  create: async (orgId: string, payload: CreateProjectPayload) => {
    return api.post<Project>(`/organizations/${orgId}/projects`, payload)
  },

  update: async (
    orgId: string,
    projectId: string,
    payload: UpdateProjectPayload
  ) => {
    return api.put<Project>(
      `/organizations/${orgId}/projects/${projectId}`,
      payload
    )
  },

  delete: async (orgId: string, projectId: string) => {
    return api.delete<{ message: string }>(
      `/organizations/${orgId}/projects/${projectId}`
    )
  },

  initiateVerification: async (
    orgId: string,
    projectId: string,
    method: VerificationMethod = "dns"
  ) => {
    return api.post<VerificationResponse>(
      `/organizations/${orgId}/projects/${projectId}/verification`,
      {
        method,
      }
    )
  },

  checkVerification: async (orgId: string, projectId: string) => {
    return api.post<CheckVerificationResponse>(
      `/organizations/${orgId}/projects/${projectId}/verification/check`
    )
  },

  getVerificationStatus: async (orgId: string, projectId: string) => {
    return api.get<VerificationResponse>(
      `/organizations/${orgId}/projects/${projectId}/verification`
    )
  },
}
