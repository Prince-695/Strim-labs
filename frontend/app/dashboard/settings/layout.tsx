"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Users, Key, User, Building } from "lucide-react"

import { PageHeader } from "@/components/shell/page-header"

const SETTINGS_TABS = [
  {
    label: "Account & Security",
    href: "/dashboard/settings/profile",
    icon: User,
  },
  {
    label: "Organization",
    href: "/dashboard/settings/organization",
    icon: Building,
  },
  { label: "Team Members", href: "/dashboard/settings/members", icon: Users },
  { label: "API Keys", href: "/dashboard/settings/api-keys", icon: Key },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Workspace Management"
        description="Manage your account profile, unique username, password rotation, workspace organization, team permissions, and ingestion API keys."
        breadcrumbs={[{ label: "Settings" }]}
      />

      {/* Settings Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-border font-mono text-xs">
        {SETTINGS_TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/")
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-brand font-semibold text-brand"
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
