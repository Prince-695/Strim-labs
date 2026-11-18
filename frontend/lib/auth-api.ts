import { api, tokenStorage } from "./api-client"
import type { UserProfile } from "./stores/auth-store"

export interface AuthResponseData {
  user: UserProfile
  refresh_token?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface SignupPayload {
  email: string
  password: string
  first_name: string
  last_name: string
}

export interface ResetPasswordPayload {
  email: string
  otp: string
  new_password: string
}

export interface GoogleAuthResponse {
  url: string
}

export const authApi = {
  login: async (payload: LoginPayload) => {
    const res = await api.post<AuthResponseData>("/auth/login", payload)
    const token = res.access_token || res.data?.refresh_token
    if (token) {
      tokenStorage.set(token)
    }
    return res
  },

  signup: async (payload: SignupPayload) => {
    const res = await api.post<AuthResponseData>("/auth/signup", payload)
    const token = res.access_token || res.data?.refresh_token
    if (token) {
      tokenStorage.set(token)
    }
    return res
  },

  forgotPassword: async (email: string) => {
    return api.post<{ message: string }>("/auth/forgot-password", { email })
  },

  resetPassword: async (payload: ResetPasswordPayload) => {
    return api.post<{ message: string }>("/auth/reset-password", payload)
  },

  verifyOtp: async (otp: string) => {
    return api.post<{ message: string; is_verified: boolean }>("/auth/otp/verify", { otp })
  },

  sendOtp: async () => {
    return api.post<{ message: string }>("/auth/otp/send")
  },

  getMe: async () => {
    return api.get<{ user: UserProfile; is_verified: boolean }>("/auth/me")
  },

  getGoogleOAuthUrl: async () => {
    return api.get<GoogleAuthResponse>("/auth/google/login")
  },

  logout: async () => {
    try {
      await api.post("/auth/logout")
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenStorage.remove()
    }
  },
}
