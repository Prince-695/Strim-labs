"use client"

import * as React from "react"
import Link from "next/link"
import {
  Globe,
  Play,
  History,
  Network,
  GitCompare,
  Sparkles,
  ShieldCheck,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import type { Project } from "@/lib/project-api"

export type ProjectDashboardTab = "overview" | "discovery" | "verification" | "settings"

interface ProjectHeaderCardProps {
  project: Project
  isVerified: boolean
  activeTab: ProjectDashboardTab
  setActiveTab: (tab: ProjectDashboardTab) => void
  onOpenCompare: () => void
  testsCount: number
  endpointsCount: number
}

export function ProjectHeaderCard({
  project,
  isVerified,
  activeTab,
  setActiveTab,
  onOpenCompare,
  testsCount,
  endpointsCount,
}: ProjectHeaderCardProps) {
  return (
    <div className="space-y-4">
      {/* Main Context Card */}
      <div className="relative rounded-xl border border-border bg-surface p-5 shadow-xs overflow-hidden">
        <CornerCrosshairs />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold font-heading text-foreground tracking-tight">
                {project.name}
              </h2>
              <span className="rounded bg-surface-raised px-2.5 py-0.5 font-mono text-[11px] uppercase text-sand border border-border-subtle">
                {project.environment}
              </span>
              <StatusBadge
                status={isVerified ? "completed" : "pending"}
                label={isVerified ? "DOMAIN VERIFIED" : "UNVERIFIED"}
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
              <Globe className="size-3.5 text-brand shrink-0" />
              <span className="text-foreground font-medium">{project.base_url}</span>
            </div>
          </div>

          {/* Direct Tab Switcher Pills */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`rounded-lg px-3 py-1.5 transition-colors border ${
                activeTab === "overview"
                  ? "border-brand bg-brand/10 text-white font-medium"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              Cockpit Overview
            </button>
            <button
              onClick={() => setActiveTab("discovery")}
              className={`rounded-lg px-3 py-1.5 transition-colors border flex items-center gap-1.5 ${
                activeTab === "discovery"
                  ? "border-brand bg-brand/10 text-white font-medium"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3 text-brand" />
              <span>API Discovery Guide</span>
            </button>
            <button
              onClick={() => setActiveTab("verification")}
              className={`rounded-lg px-3 py-1.5 transition-colors border flex items-center gap-1.5 ${
                activeTab === "verification"
                  ? "border-brand bg-brand/10 text-white font-medium"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              <ShieldCheck className="size-3 text-emerald-400" />
              <span>Verification Setup</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`rounded-lg px-3 py-1.5 transition-colors border ${
                activeTab === "settings"
                  ? "border-brand bg-brand/10 text-white font-medium"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Quick Route Shortcuts Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <Link
          href={`/dashboard/runner?project=${project.id}`}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-border-subtle bg-surface hover:border-brand/40 hover:bg-surface-raised/40 transition-colors group"
        >
          <div className="size-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand group-hover:scale-105 transition-transform">
            <Play className="size-3.5 fill-current" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-foreground block truncate">Load Runner</span>
            <span className="text-[10px] text-foreground-subtle">Configure stress test</span>
          </div>
        </Link>

        <Link
          href={`/dashboard/tests?project=${project.id}`}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-border-subtle bg-surface hover:border-brand/40 hover:bg-surface-raised/40 transition-colors group"
        >
          <div className="size-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
            <History className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-foreground block truncate">Test History</span>
            <span className="text-[10px] text-foreground-subtle">{testsCount} recorded runs</span>
          </div>
        </Link>

        <Link
          href={`/dashboard/projects/${project.id}/endpoints`}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-border-subtle bg-surface hover:border-brand/40 hover:bg-surface-raised/40 transition-colors group"
        >
          <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <Network className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-foreground block truncate">Endpoints</span>
            <span className="text-[10px] text-foreground-subtle">{endpointsCount} discovered</span>
          </div>
        </Link>

        <button
          type="button"
          onClick={onOpenCompare}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-border-subtle bg-surface hover:border-brand/40 hover:bg-surface-raised/40 transition-colors text-left group"
        >
          <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
            <GitCompare className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-foreground block truncate">Compare Runs</span>
            <span className="text-[10px] text-foreground-subtle">A/B regression studio</span>
          </div>
        </button>
      </div>
    </div>
  )
}
