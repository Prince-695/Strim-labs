import { api } from "./api-client"
import { type UserProfile } from "./stores/auth-store"

export interface CheckUsernameResponse {
  username: string
  available: boolean
}

export interface UpdateProfilePayload {
  first_name: string
  last_name: string
}

export interface ChangePasswordPayload {
  old_password: string
  new_password: string
}

export const userApi = {
  // GET /v1/users/me
  getMe: async () => {
    return api.get<UserProfile>("/users/me")
  },

  // GET /v1/users/username?u=...
  checkUsername: async (username: string) => {
    return api.get<CheckUsernameResponse>(
      `/users/username?u=${encodeURIComponent(username.trim().toLowerCase())}`
    )
  },

  // POST /v1/users/username
  setUsername: async (username: string) => {
    return api.post<UserProfile>("/users/username", {
      username: username.trim().toLowerCase(),
    })
  },

  // PUT /v1/users/update
  updateProfile: async (payload: UpdateProfilePayload) => {
    return api.put<UserProfile>("/users/update", payload)
  },

  // POST /v1/auth/change-password
  changePassword: async (payload: ChangePasswordPayload) => {
    return api.post<{ message: string }>("/auth/change-password", payload)
  },
}
