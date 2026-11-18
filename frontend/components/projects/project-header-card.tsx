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

export type ProjectDashboardTab =
  "overview" | "discovery" | "verification" | "settings"

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
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-xs">
        <CornerCrosshairs />

        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                {project.name}
              </h2>
              <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-0.5 font-mono text-[11px] text-sand uppercase">
                {project.environment}
              </span>
              <StatusBadge
                status={isVerified ? "completed" : "pending"}
                label={isVerified ? "DOMAIN VERIFIED" : "UNVERIFIED"}
              />
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
              <Globe className="size-3.5 shrink-0 text-brand" />
              <span className="font-medium text-foreground">
                {project.base_url}
              </span>
            </div>
          </div>

          {/* Direct Tab Switcher Pills */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`rounded-lg border px-3 py-1.5 transition-colors ${
                activeTab === "overview"
                  ? "border-brand bg-brand/10 font-medium text-white"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              Cockpit Overview
            </button>
            <button
              onClick={() => setActiveTab("discovery")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${
                activeTab === "discovery"
                  ? "border-brand bg-brand/10 font-medium text-white"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3 text-brand" />
              <span>API Discovery Guide</span>
            </button>
            <button
              onClick={() => setActiveTab("verification")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${
                activeTab === "verification"
                  ? "border-brand bg-brand/10 font-medium text-white"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              <ShieldCheck className="size-3 text-emerald-400" />
              <span>Verification Setup</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`rounded-lg border px-3 py-1.5 transition-colors ${
                activeTab === "settings"
                  ? "border-brand bg-brand/10 font-medium text-white"
                  : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
              }`}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Quick Route Shortcuts Bar */}
      <div className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
        <Link
          href={`/dashboard/runner?project=${project.id}`}
          className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface p-3 transition-colors hover:border-brand/40 hover:bg-surface-raised/40"
        >
          <div className="flex size-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand transition-transform group-hover:scale-105">
            <Play className="size-3.5 fill-current" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              Load Runner
            </span>
            <span className="text-[10px] text-foreground-subtle">
              Configure stress test
            </span>
          </div>
        </Link>

        <Link
          href={`/dashboard/tests?project=${project.id}`}
          className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface p-3 transition-colors hover:border-brand/40 hover:bg-surface-raised/40"
        >
          <div className="flex size-8 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-400 transition-transform group-hover:scale-105">
            <History className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              Test History
            </span>
            <span className="text-[10px] text-foreground-subtle">
              {testsCount} recorded runs
            </span>
          </div>
        </Link>

        <Link
          href={`/dashboard/projects/${project.id}/endpoints`}
          className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface p-3 transition-colors hover:border-brand/40 hover:bg-surface-raised/40"
        >
          <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-transform group-hover:scale-105">
            <Network className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              Endpoints
            </span>
            <span className="text-[10px] text-foreground-subtle">
              {endpointsCount} discovered
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={onOpenCompare}
          className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface p-3 text-left transition-colors hover:border-brand/40 hover:bg-surface-raised/40"
        >
          <div className="flex size-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 transition-transform group-hover:scale-105">
            <GitCompare className="size-3.5" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-semibold text-foreground">
              Compare Runs
            </span>
            <span className="text-[10px] text-foreground-subtle">
              A/B regression studio
            </span>
          </div>
        </button>
      </div>
    </div>
  )
}
