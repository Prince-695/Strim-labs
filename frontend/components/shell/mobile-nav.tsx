"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  X,
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
  User as UserIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/lib/stores/ui-store"
import { useAuthStore } from "@/lib/stores/auth-store"
import { WorkspaceSwitcher } from "@/components/shell/workspace-switcher"
import { Button } from "@/components/ui/button"

const navSections = [
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
      { title: "Organization", href: "/dashboard/settings/organization", icon: Building },
      { title: "Account & Profile", href: "/dashboard/settings/profile", icon: Settings },
    ],
  },
]

export function MobileNav() {
  const pathname = usePathname()
  const { mobileNavOpen, setMobileNavOpen } = useUIStore()
  const { user, logout } = useAuthStore()

  // Close drawer on path change
  React.useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname, setMobileNavOpen])

  if (!mobileNavOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="relative flex w-full max-w-xs flex-1 flex-col bg-sidebar border-r border-sidebar-border shadow-2xl">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link
            href="/dashboard"
            onClick={() => setMobileNavOpen(false)}
            className="flex items-center gap-2.5"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border p-1 overflow-hidden">
              <Image
                src="/logo.png"
                alt="Strim Labs Logo"
                width={28}
                height={28}
                priority
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-mono text-sm font-bold tracking-tight text-foreground">
                STRIM
              </span>
              <span className="text-[10px] font-mono tracking-widest text-sand uppercase">
                LABS
              </span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Workspace Switcher */}
        <div className="border-b border-sidebar-border p-3">
          <WorkspaceSwitcher />
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="px-2 pb-1 font-mono text-[10px] font-semibold text-foreground-subtle uppercase tracking-wider">
                {section.title}
              </h4>
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
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-brand-subtle text-foreground border border-brand/30 font-semibold [&_svg]:text-brand"
                          : "text-foreground-muted hover:bg-surface-raised hover:text-foreground [&_svg]:text-foreground-subtle"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
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
        </div>
      </div>
    </div>
  )
}
