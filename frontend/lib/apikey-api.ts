import { api } from "./api-client"

export interface ApiKeyItem {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  created_at: string
  last_used_at?: string
  expires_at?: string
}

export interface CreateApiKeyResponse {
  key: ApiKeyItem
  raw_key: string // Only revealed once upon creation
}

export const apikeyApi = {
  list: async (orgId: string, projectId: string) => {
    return api.get<ApiKeyItem[]>(
      `/organizations/${orgId}/projects/${projectId}/api-keys`
    )
  },

  create: async (
    orgId: string,
    projectId: string,
    payload: { name: string; scopes: string[] }
  ) => {
    return api.post<CreateApiKeyResponse>(
      `/organizations/${orgId}/projects/${projectId}/api-keys`,
      payload
    )
  },

  rotate: async (orgId: string, projectId: string, keyId: string) => {
    return api.post<CreateApiKeyResponse>(
      `/organizations/${orgId}/projects/${projectId}/api-keys/${keyId}/rotate`
    )
  },

  revoke: async (orgId: string, projectId: string, keyId: string) => {
    return api.delete<{ message: string }>(
      `/organizations/${orgId}/projects/${projectId}/api-keys/${keyId}`
    )
  },
}
