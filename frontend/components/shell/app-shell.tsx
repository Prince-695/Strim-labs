"use client"

import * as React from "react"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { AppTopbar } from "@/components/shell/app-topbar"
import { MobileNav } from "@/components/shell/mobile-nav"
import { AuthGuard } from "@/components/auth/auth-guard"
import { CreateProjectModal } from "@/components/projects/create-project-modal"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Desktop Sidebar */}
        <AppSidebar />

        {/* Mobile Drawer */}
        <MobileNav />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>

        {/* In-Place Project Registration Modal */}
        <CreateProjectModal />
      </div>
    </AuthGuard>
  )
}
