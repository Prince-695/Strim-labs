import { create } from "zustand"
import { tokenStorage } from "@/lib/api-client"

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
  logout: () => void
  initialize: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (token, user) => {
    tokenStorage.set(token)
    set({ token, user, isAuthenticated: true, isLoading: false })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    tokenStorage.remove()
    set({ token: null, user: null, isAuthenticated: false, isLoading: false })
  },

  initialize: () => {
    const token = tokenStorage.get()
    set({ token, isAuthenticated: Boolean(token), isLoading: false })
  },
}))
