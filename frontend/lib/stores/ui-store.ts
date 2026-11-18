import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UIState {
  currentOrgId: string | null
  currentProjectId: string | null
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  isCreateProjectOpen: boolean
  setOrgId: (id: string | null) => void
  setCurrentOrgId: (id: string | null) => void
  setProjectId: (id: string | null) => void
  setCurrentProjectId: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setCreateProjectOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      currentOrgId: null,
      currentProjectId: null,
      sidebarCollapsed: false,
      mobileNavOpen: false,
      isCreateProjectOpen: false,

      setOrgId: (currentOrgId) => set({ currentOrgId }),
      setCurrentOrgId: (currentOrgId) => set({ currentOrgId }),
      setProjectId: (currentProjectId) => set({ currentProjectId }),
      setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setCreateProjectOpen: (isCreateProjectOpen) => set({ isCreateProjectOpen }),
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
