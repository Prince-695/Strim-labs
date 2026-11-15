"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Play, BookOpen } from "lucide-react"
import { useUIStore } from "@/lib/stores/ui-store"
import { ProjectSwitcher } from "@/components/shell/project-switcher"
import { Button } from "@/components/ui/button"

export function AppTopbar() {
  const pathname = usePathname()
  const { setMobileNavOpen } = useUIStore()

  // Format pathname into readable breadcrumbs
  const pathSegments = pathname.split("/").filter(Boolean)
  const currentSection = pathSegments[1]
    ? pathSegments[1].charAt(0).toUpperCase() + pathSegments[1].slice(1)
    : "Overview"

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Left Area: Mobile Menu + Context */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileNavOpen(true)}
          className="md:hidden text-foreground-muted"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>

        {/* Breadcrumb Context */}
        <div className="hidden items-center gap-2 text-xs font-mono text-foreground-subtle sm:flex">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            console
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">{currentSection.toLowerCase()}</span>
        </div>

        {/* Divider */}
        <div className="hidden h-4 w-px bg-border sm:block" />

        {/* Project & Target Context Switcher */}
        <ProjectSwitcher />
      </div>

      {/* Right Area: Status + Actions */}
      <div className="flex items-center gap-3">
        {/* Real-time platform status chip */}
        <div className="hidden items-center gap-2 rounded-md border border-border-subtle bg-surface px-2.5 py-1 text-xs font-mono sm:flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className="text-[11px] text-foreground-muted">System Operational</span>
        </div>

        {/* Swagger / Docs Link */}
        <Button
          variant="ghost"
          size="sm"
          render={
            <a
              href="https://strim-labs.onrender.com/swagger/index.html"
              target="_blank"
              rel="noopener noreferrer"
              title="Swagger API Documentation"
            />
          }
          className="hidden gap-1.5 text-xs text-foreground-muted hover:text-foreground sm:inline-flex"
        >
          <BookOpen className="size-3.5" />
          <span>API Docs</span>
        </Button>

        {/* Primary Call-to-Action: Launch Load Runner */}
        <Button
          size="sm"
          render={<Link href="/dashboard/runner" />}
          className="gap-1.5 bg-brand text-white hover:bg-brand-hover shadow-xs font-medium text-xs"
        >
          <Play className="size-3 fill-current" />
          <span>Run Test</span>
        </Button>
      </div>
    </header>
  )
}
