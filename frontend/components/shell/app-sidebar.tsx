"use client"

import * as React from "react"
import Link from "next/link"
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
  Building,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
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
      { title: "Targets & Verification", href: "/dashboard/targets", icon: Crosshair },
    ],
  },
  {
    title: "Testing",
    items: [
      { title: "Load Runner", href: "/dashboard/runner", icon: Rocket },
      { title: "Test History", href: "/dashboard/tests", icon: History },
      { title: "Capacity Analysis", href: "/dashboard/capacity", icon: Gauge },
      { title: "Compare Runs", href: "/dashboard/compare", icon: GitCompare },
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
    title: "Manage",
    items: [
      { title: "Integrations", href: "/dashboard/integrations", icon: Blocks },
      { title: "API Keys", href: "/dashboard/api-keys", icon: Key },
      { title: "Organization", href: "/dashboard/organization", icon: Building },
      { title: "Settings", href: "/dashboard/settings/profile", icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, logout } = useAuthStore()

  return (
    <aside
      className={cn(
        "relative hidden flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 md:flex",
        sidebarCollapsed ? "w-[68px]" : "w-[250px]"
      )}
    >
      {/* Brand & Wordmark */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          {/* Logo Glyph */}
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border shadow-inner">
            <span className="font-mono text-sm font-bold tracking-tighter text-brand">S</span>
            <span className="font-mono text-sm font-bold tracking-tighter text-sand">L</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-none">
              <span className="font-mono text-sm font-bold tracking-tight text-foreground">
                STRIM
              </span>
              <span className="text-[10px] font-mono tracking-widest text-sand uppercase">
                LABS
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden rounded p-1 text-foreground-subtle hover:bg-surface-raised hover:text-foreground md:flex"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Workspace Switcher */}
      {!sidebarCollapsed && (
        <div className="border-b border-sidebar-border p-3">
          <WorkspaceSwitcher />
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6">
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

      {/* Sidebar Footer */}
      <div className="border-t border-sidebar-border p-2">
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface/50 p-2">
            <div className="flex items-center gap-2.5 truncate">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-raised border border-border text-foreground-muted">
                <UserIcon className="size-4" />
              </div>
              <div className="truncate leading-tight">
                <p className="text-xs font-medium text-foreground truncate">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : "Developer"}
                </p>
                <p className="font-mono text-[10px] text-foreground-subtle truncate">
                  {user?.email || "api@strimlabs.dev"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={logout}
              title="Sign Out"
              className="text-foreground-subtle hover:text-danger"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Sign Out"
              className="size-8 text-foreground-subtle hover:text-danger"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
