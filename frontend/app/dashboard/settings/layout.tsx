"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, Key, User } from "lucide-react"

import { PageHeader } from "@/components/shell/page-header"

const SETTINGS_TABS = [
  { label: "Team Members", href: "/dashboard/settings/members", icon: Users },
  { label: "API Keys & Ingestion", href: "/dashboard/settings/api-keys", icon: Key },
  { label: "Account Profile", href: "/dashboard/settings/profile", icon: User },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Workspace Management"
        description="Manage workspace organization access, team member permissions, ingestion API keys, and account security."
        breadcrumbs={[
          { label: "Settings" },
        ]}
      />

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-border font-mono text-xs overflow-x-auto">
        {SETTINGS_TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "border-brand text-brand font-semibold"
                  : "border-transparent text-foreground-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>

      <div>{children}</div>
    </div>
  )
}
