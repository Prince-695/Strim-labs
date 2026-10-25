"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  Play,
  Plus,
  Radio,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AddTargetModal } from "./add-target-modal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "./ui/table";
import { fmtDateTime, fmtMs, fmtRps, hostOf } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { useSession } from "@/lib/session";

export function DashboardView() {
  const router = useRouter();
  const { projects, projectsLoading, org, setProjectId } = useSession();
  const [addOpen, setAddOpen] = useState(false);

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const pendingCount = projects.filter((p) => p.status === "PENDING_SDK").length;
  const incidentCount = projects.filter((p) => p.status === "INCIDENT" || p.status === "DEGRADED").length;

  // Aggregate metrics
  const totalRoutes = useMemo(
    () => projects.reduce((acc, p) => acc + (p._count?.discoveredRoutes ?? 0), 0),
    [projects]
  );

  if (projectsLoading) {
    return <DashboardLoadingSkeleton />;
  }

  return (
    <div className="space-y-7">
      {/* Top Banner: Org Overview */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Workspace Overview
            </h1>
            <span className="rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand-strong dark:text-brand">
              {org?.name || "Acme Corp"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Continuous production observability, real-time error flags, and automated 7-day breakpoint diagnosis.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/projects">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Layers className="size-3.5" /> All Projects ({projects.length})
            </Button>
          </Link>
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5 text-xs shadow-sm">
            <Plus className="size-3.5" /> Add Project or Server
          </Button>
        </div>
      </div>

      {/* 4 KPI Top Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Projects Quota */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm transition-all hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects Limit
            </span>
            <Layers className="size-4 text-brand" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{projects.length}</span>
            <span className="font-mono text-xs text-muted-foreground">/ 5 max</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${Math.min(100, (projects.length / 5) * 100)}%` }}
            />
          </div>
        </div>

        {/* 7-Day Breakpoint Cadence */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm transition-all hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Breakpoint Cadence
            </span>
            <Calendar className="size-4 text-warning" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">7-Day</span>
            <span className="font-mono text-xs text-muted-foreground">Automated Cycle</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Continuous saturation & knee detection
          </p>
        </div>

        {/* Real-time Health */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm transition-all hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Production Health
            </span>
            <Radio className="size-4 text-success" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-success">
              {incidentCount === 0 ? "100%" : `${incidentCount} Issues`}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {incidentCount === 0 ? "Healthy" : "Incident"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {activeCount} active • {pendingCount} awaiting SDK
          </p>
        </div>

        {/* Auto-Discovered Endpoints */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm transition-all hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Auto-Discovered Routes
            </span>
            <Compass className="size-4 text-brand" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{totalRoutes}</span>
            <span className="font-mono text-xs text-muted-foreground">Live routes</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Streamed in real-time by @strim/sdk
          </p>
        </div>
      </div>

      {/* Active Projects Summary Widget */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-brand" />
              <CardTitle>Active Organization Projects</CardTitle>
            </div>
            <CardDescription>
              Services monitored in {org?.name || "your organization"}.
            </CardDescription>
          </div>
          <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            View all projects ({projects.length}) <ChevronRight className="size-3.5" />
          </Link>
        </CardHeader>

        <div className="border-t border-border">
          {projects.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No projects added yet. Click &quot;Add Project or Server&quot; above to connect your first API.
            </div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Service / Project</TH>
                  <TH>Base URL</TH>
                  <TH>Health Status</TH>
                  <TH>7-Day Saturation Knee</TH>
                  <TH className="text-right">Auto-Discovered Routes</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {projects.map((p) => {
                  const status = p.status || "PENDING_SDK";
                  const latestRun = p.testRuns?.[0];
                  const bp = latestRun?.breakingPoint;
                  const routesCount = p._count?.discoveredRoutes ?? 0;

                  return (
                    <TR key={p.id}>
                      <TD>
                        <p className="font-semibold text-foreground text-xs">{p.name}</p>
                      </TD>
                      <TD>
                        <span className="font-mono text-xs text-muted-foreground">
                          {hostOf(p.baseUrl || p.targetUrl)}
                        </span>
                      </TD>
                      <TD>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : status === "INCIDENT"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              status === "ACTIVE"
                                ? "bg-emerald-500 animate-pulse"
                                : status === "INCIDENT"
                                ? "bg-rose-500 animate-ping"
                                : "bg-neutral-400"
                            }`}
                          />
                          {status === "ACTIVE"
                            ? "Healthy"
                            : status === "INCIDENT"
                            ? "Incident"
                            : "Pending SDK"}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {bp ? `${fmtRps(bp.kneeRps)} RPS` : "850 RPS (Est.)"}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">
                          {bp ? `(${bp.bottleneck.replace(/_/g, " ")})` : ""}
                        </span>
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        {routesCount} routes
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/projects/${p.id}`}
                          onClick={() => setProjectId(p.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                        >
                          Open Console <ArrowRight className="size-3" />
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </div>
      </Card>

      {/* Automated 7-Day Breakpoint Cadence Information Card */}
      <Card className="p-5 border-border bg-gradient-to-r from-card to-surface-muted/50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-brand" />
              <h3 className="text-sm font-semibold text-foreground">
                Automated 7-Day Breakpoint Diagnosis Cadence
              </h3>
              <Badge tone="brand">Active Cadence</Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              STRIM Labs automatically runs high-precision capacity ramp benchmarks every 7 days across your organization to diagnose saturation knees and bottleneck ceilings before peak production traffic hits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/projects">
              <Button size="sm" className="gap-2">
                Manage Services & Breakpoints <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <AddTargetModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
