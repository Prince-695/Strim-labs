import { api } from "./api-client"

export interface WebhookItem {
  id: string
  org_id: string
  project_id: string
  url: string
  events: string[]
  secret?: string
  active?: boolean
  created_at: string
}

export interface CreateWebhookPayload {
  url: string
  events: string[]
  secret?: string
}

export const webhookApi = {
  list: async (orgId: string, projectId: string) => {
    return api.get<WebhookItem[]>(
      `/organizations/${orgId}/projects/${projectId}/webhooks`
    )
  },

  create: async (
    orgId: string,
    projectId: string,
    payload: CreateWebhookPayload
  ) => {
    return api.post<WebhookItem>(
      `/organizations/${orgId}/projects/${projectId}/webhooks`,
      payload
    )
  },

  delete: async (orgId: string, projectId: string, webhookId: string) => {
    return api.delete<{ message: string }>(
      `/organizations/${orgId}/projects/${projectId}/webhooks/${webhookId}`
    )
  },
}
