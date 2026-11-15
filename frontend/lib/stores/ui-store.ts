import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UIState {
  currentOrgId: string | null
  currentProjectId: string | null
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  setOrgId: (id: string | null) => void
  setProjectId: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setMobileNavOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      currentOrgId: null,
      currentProjectId: null,
      sidebarCollapsed: false,
      mobileNavOpen: false,

      setOrgId: (currentOrgId) => set({ currentOrgId }),
      setProjectId: (currentProjectId) => set({ currentProjectId }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
    }),
    {
      name: "strim_ui_preferences",
      partialize: (state) => ({
        currentOrgId: state.currentOrgId,
        currentProjectId: state.currentProjectId,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
