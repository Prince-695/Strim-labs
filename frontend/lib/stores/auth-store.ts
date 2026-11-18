import { create } from "zustand"
import { tokenStorage, api } from "@/lib/api-client"

export interface UserProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  username?: string
  is_verified: boolean
  role?: string
}

interface AuthState {
  user: UserProfile | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  setAuth: (token: string, user: UserProfile) => void
  setUser: (user: UserProfile) => void
  refreshProfile: () => Promise<UserProfile | null>
  logout: () => void
  initialize: () => void
}

const USER_KEY = "strim_user"

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (token, user) => {
    tokenStorage.set(token)
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    }
    set({ token, user, isAuthenticated: true, isLoading: false })
  },

  setUser: (user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    }
    set({ user })
  },

  refreshProfile: async () => {
    try {
      const res = await api.get<UserProfile>("/users/me")
      if (res.data) {
        get().setUser(res.data)
        return res.data
      }
    } catch {
      // ignore network/auth errors during refresh
    }
    return null
  },

  logout: () => {
    tokenStorage.remove()
    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_KEY)
    }
    set({ token: null, user: null, isAuthenticated: false, isLoading: false })
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  },

  initialize: () => {
    const token = tokenStorage.get()
    let cachedUser: UserProfile | null = null
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(USER_KEY)
        if (raw) cachedUser = JSON.parse(raw)
      } catch {
        // ignore parse error
      }
    }
    set({ token, user: cachedUser, isAuthenticated: Boolean(token), isLoading: false })

    // If authenticated, refresh profile in background to get latest username, etc.
    if (token) {
      api.get<UserProfile>("/users/me").then((res) => {
        if (res.data) {
          get().setUser(res.data)
        }
      }).catch(() => {})
    }
  },
}))
