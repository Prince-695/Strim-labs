"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  Crosshair,
  Rocket,
  History,
  Gauge,
  GitCompare,
  LineChart,
  Network,
  Sparkles,
  Blocks,
  Key,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/lib/stores/ui-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher"
import { Button } from "@/components/ui/button"

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { title: "Projects", href: "/dashboard/projects", icon: FolderKanban },
    ],
  },
  {
    title: "Testing",
    items: [
      { title: "Load Runner", href: "/dashboard/runner", icon: Rocket },
      { title: "Test History", href: "/dashboard/tests", icon: History },
    ],
  },
  {
    title: "Observability",
    items: [
      { title: "Metrics", href: "/dashboard/metrics", icon: LineChart },
      { title: "Endpoints", href: "/dashboard/endpoints", icon: Network },
      { title: "Discovery", href: "/dashboard/discovery", icon: Sparkles },
    ],
  },
  {
    title: "Configuration",
    items: [
      { title: "Integrations", href: "/dashboard/integrations", icon: Blocks },
      { title: "API Keys", href: "/dashboard/settings/api-keys", icon: Key },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed } = useUIStore()
  const { logout } = useAuthStore()

  return (
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-screen max-h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 md:flex overflow-hidden",
        sidebarCollapsed ? "w-[68px]" : "w-[250px]"
      )}
    >
      {/* Brand & Wordmark */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border transition-all",
          sidebarCollapsed ? "justify-center px-2" : "justify-start px-4"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden"
          title={sidebarCollapsed ? "Strim Labs" : undefined}
        >
          {/* Logo Glyph */}
          <div className="size-8 shrink-0 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Strim Labs Logo"
              width={32}
              height={32}
              priority
              className="size-8 object-contain"
            />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-none">
              <span className="font-mono text-sm font-light text-foreground">
                Strim-Labs
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Workspace Switcher */}
      {!sidebarCollapsed && (
        <div className="shrink-0 border-b border-sidebar-border p-3">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Navigation Links (Scrollable only if items overflow height) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-6">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!sidebarCollapsed && (
              <h4 className="px-2 pb-1 font-mono text-[10px] font-semibold text-foreground-subtle uppercase tracking-wider">
                {section.title}
              </h4>
            )}
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={sidebarCollapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-brand-subtle text-foreground border border-brand/30 shadow-xs font-semibold [&_svg]:text-brand"
                        : "text-foreground-muted hover:bg-surface-raised hover:text-foreground [&_svg]:text-foreground-subtle hover:[&_svg]:text-foreground",
                      sidebarCollapsed && "justify-center px-0 py-2"
                    )}
                  >
                    <Icon className="size-4 shrink-0 transition-colors" />
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.title}</span>
                    )}
                    {!sidebarCollapsed && item.badge && (
                      <span className="ml-auto rounded bg-brand/20 px-1.5 py-0.2 font-mono text-[10px] text-brand">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Sidebar Footer: Fixed Sign Out Button at Bottom */}
      <div className="shrink-0 mt-auto border-t border-sidebar-border p-2 bg-sidebar">
        {!sidebarCollapsed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full text-foreground-subtle hover:text-danger hover:bg-danger/10 text-xs font-mono justify-start gap-2.5 px-3 transition-colors"
          >
            <LogOut className="size-4 text-danger" />
            <span>Sign Out</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="Sign Out"
            className="size-9 mx-auto flex text-foreground-subtle hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="size-4 text-danger" />
          </Button>
        )}
      </div>
    </aside>
  )
}
