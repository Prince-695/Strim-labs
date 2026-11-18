import { api } from "./api-client"

export type OrgRole = "owner" | "admin" | "member" | "viewer"

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  role?: OrgRole
  member_count: number
  project_count: number
  created_at: string
}

export interface CreateOrgPayload {
  name: string
  slug: string
  description?: string
}

export interface UpdateOrgPayload {
  name: string
  description?: string
}

export interface OrgMember {
  user_id: string
  email: string
  first_name: string
  last_name: string
  username?: string
  role: OrgRole
  joined_at: string
}

export const orgApi = {
  list: async () => {
    return api.get<Organization[]>("/organizations")
  },

  get: async (orgId: string) => {
    return api.get<Organization>(`/organizations/${orgId}`)
  },

  create: async (payload: CreateOrgPayload) => {
    return api.post<Organization>("/organizations", payload)
  },

  update: async (orgId: string, payload: UpdateOrgPayload) => {
    return api.put<Organization>(`/organizations/${orgId}`, payload)
  },

  delete: async (orgId: string, confirmSlug: string) => {
    return api.delete<{ message: string }>(`/organizations/${orgId}`, {
      body: { confirm_slug: confirmSlug },
    })
  },

  listMembers: async (orgId: string) => {
    return api.get<OrgMember[]>(`/organizations/${orgId}/members`)
  },

  addMember: async (
    orgId: string,
    payload: { email: string; role: OrgRole }
  ) => {
    return api.post<OrgMember>(`/organizations/${orgId}/members`, payload)
  },

  updateMemberRole: async (orgId: string, userId: string, role: OrgRole) => {
    return api.put<OrgMember>(
      `/organizations/${orgId}/members/${userId}/role`,
      { role }
    )
  },

  removeMember: async (orgId: string, userId: string) => {
    return api.delete<{ message: string }>(
      `/organizations/${orgId}/members/${userId}`
    )
  },

  leave: async (orgId: string) => {
    return api.post<{ message: string }>(
      `/organizations/${orgId}/members/leave`
    )
  },
}
