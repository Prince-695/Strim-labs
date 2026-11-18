"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Play, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useUIStore } from "@/lib/stores/ui-store"
import { ProjectSwitcher } from "@/components/shell/project-switcher"
import { UserMenuDropdown } from "@/components/shell/user-menu-dropdown"
import { Button } from "@/components/ui/button"

export function AppTopbar() {
  const pathname = usePathname()
  const { setMobileNavOpen, sidebarCollapsed, toggleSidebar } = useUIStore()

  // Format pathname into readable breadcrumbs
  const pathSegments = pathname.split("/").filter(Boolean)
  const currentSection = pathSegments[1]
    ? pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1)
    : "Overview"

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Left Area: Sidebar Toggle + Mobile Menu + Context */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileNavOpen(true)}
          className="text-foreground-muted hover:text-foreground md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>

        {/* Desktop Sidebar Collapse Toggle Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          className="hidden text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground md:flex"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>

        {/* Breadcrumb Context */}
        <div className="hidden items-center gap-2 font-mono text-xs text-foreground-subtle lg:flex">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground"
          >
            console
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">
            {currentSection.toLowerCase()}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden h-4 w-px bg-border sm:block" />

        {/* Project & Target Context Switcher */}
        <ProjectSwitcher />
      </div>

      {/* Right Area: User Account & Organization Settings Dropdown */}
      <div className="flex items-center gap-2.5">
        <UserMenuDropdown />
      </div>
    </header>
  )
}
