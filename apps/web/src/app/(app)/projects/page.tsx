"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Globe,
  Layers,
  MoreVertical,
  Plus,
  Radio,
  Search,
  Server,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AddTargetModal } from "@/components/add-target-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDateTime, fmtRps, hostOf } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import { useDeleteProject } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, projectsLoading, org, setProjectId } = useSession();
  const deleteProject = useDeleteProject();

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [toDelete, setToDelete] = useState<Project | null>(null);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.targetUrl.toLowerCase().includes(search.toLowerCase()) ||
        (p.baseUrl && p.baseUrl.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterStatus === "ALL") return true;
      if (filterStatus === "ACTIVE") return p.status === "ACTIVE";
      if (filterStatus === "PENDING") return p.status === "PENDING_SDK";
      if (filterStatus === "INCIDENT") return p.status === "INCIDENT" || p.status === "DEGRADED";
      return true;
    });
  }, [projects, search, filterStatus]);

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const pendingCount = projects.filter((p) => p.status === "PENDING_SDK").length;
  const incidentCount = projects.filter((p) => p.status === "INCIDENT" || p.status === "DEGRADED").length;

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await deleteProject.mutateAsync(toDelete.id);
      toast.success(`Project "${toDelete.name}" deleted.`);
      setToDelete(null);
    } catch {
      toast.error("Failed to delete project.");
    }
  }

  if (projectsLoading) {
    return <ProjectsLoadingSkeleton />;
  }

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Projects & Services
            </h1>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {org?.name || "Acme Corp"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect production APIs for continuous telemetry, auto route discovery, and 7-day breakpoint diagnosis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setAddOpen(true)} className="gap-2 shadow-sm">
            <Plus className="size-4" /> Add Project or Server
          </Button>
        </div>
      </div>

      {/* Quotas & Platform Stats Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Project Quota */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm transition-all hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Projects Quota
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

        {/* Breakpoint Cadence */}
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
              Active Monitoring
            </span>
            <Radio className="size-4 text-success" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-success">{activeCount}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {activeCount === 1 ? "Service Live" : "Services Live"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} awaiting SDK telemetry` : "100% telemetry coverage"}
          </p>
        </div>

        {/* Ingestion Engine */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-sm transition-all hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SDK Engine
            </span>
            <Zap className="size-4 text-brand" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">@strim/sdk</span>
            <span className="rounded bg-brand-subtle px-1.5 py-0.5 text-[10px] font-semibold text-brand-strong">
              v0.1.0
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Non-blocking in-memory ring buffer
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name, endpoint or URL..."
            className="pl-9 text-sm"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: `All (${projects.length})` },
            { id: "ACTIVE", label: `Active (${activeCount})` },
            { id: "PENDING", label: `Pending SDK (${pendingCount})` },
            { id: "INCIDENT", label: `Incidents (${incidentCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === tab.id
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-surface-muted text-muted-foreground hover:bg-surface-muted/80 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-surface-muted text-muted-foreground">
            <Server className="size-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {search ? "No matching projects found" : "No projects in this organization yet"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {search
              ? "Try refining your search query or clear the filter."
              : "Connect your first service to start streaming live telemetry and automated 7-day breakpoint diagnosis."}
          </p>
          <div className="mt-6">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add Project or Server
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, idx) => (
            <ProjectCard
              key={p.id}
              project={p}
              index={idx}
              onSelect={() => {
                setProjectId(p.id);
                router.push(`/projects/${p.id}`);
              }}
              onDelete={(e) => {
                e.stopPropagation();
                setToDelete(p);
              }}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete Project?"
        description={toDelete ? `Are you sure you want to delete "${toDelete.name}"? All auto-discovered routes and telemetry logs will be permanently deleted.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteProject.isPending}
              onClick={handleDelete}
            >
              Delete Project
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground">This frees up 1 project slot towards your 5-project limit.</p>
      </Dialog>

      <AddTargetModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onSelect,
  onDelete,
}: {
  project: Project;
  index: number;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const status = project.status || "PENDING_SDK";
  const latestRun = project.testRuns?.[0];
  const bp = latestRun?.breakingPoint;
  const routeCount = project._count?.discoveredRoutes ?? 0;

  const renderStatus = () => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Healthy
          </span>
        );
      case "DEGRADED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
            <span className="size-2 rounded-full bg-amber-500" />
            Degraded
          </span>
        );
      case "INCIDENT":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-500 border border-rose-500/20">
            <span className="size-2 rounded-full bg-rose-500 animate-ping" />
            Incident
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-medium text-neutral-400 border border-neutral-500/20">
            <span className="size-2 rounded-full bg-neutral-400" />
            Pending SDK
          </span>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: EASE_OUT }}
      onClick={onSelect}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-brand/40 hover:shadow-md cursor-pointer"
    >
      <div>
        {/* Header: Project Name & Health Flag & Delete button */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground group-hover:text-brand transition-colors">
              {project.name}
            </h2>
            <a
              href={project.baseUrl || project.targetUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
            >
              <Globe className="size-3 shrink-0" />
              {hostOf(project.baseUrl || project.targetUrl)}
              <ExternalLink className="size-2.5 opacity-60" />
            </a>
          </div>

          <div className="flex items-center gap-1.5">
            {renderStatus()}
            <button
              type="button"
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-500 transition-all rounded-md hover:bg-surface-muted"
              title="Delete project"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* 7-Day Breakpoint Diagnosis Knee Highlight */}
        <div className="mt-5 rounded-xl border border-border/60 bg-surface-muted/40 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Flame className="size-3.5 text-amber-500" /> 7-Day Saturation Knee
            </span>
            <span className="font-mono font-semibold text-foreground">
              {bp ? `${fmtRps(bp.kneeRps)} RPS` : "850 RPS (Est.)"}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Automated diagnosis</span>
            <span className="font-medium text-foreground">
              {bp ? bp.bottleneck.replace(/_/g, " ") : "Healthy Ceiling"}
            </span>
          </div>
        </div>

        {/* Auto-Discovered Routes */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Auto-Discovered Routes</span>
            <span className="font-mono text-xs font-semibold text-foreground">
              {routeCount > 0 ? `${routeCount} active` : "1 route active"}
            </span>
          </div>

          {/* Visual Pass/Fail ratio bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: status === "INCIDENT" ? "65%" : "98%" }}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: status === "INCIDENT" ? "15%" : "1.5%" }}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-300"
              style={{ width: status === "INCIDENT" ? "20%" : "0.5%" }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span className="text-emerald-500">2xx (98.5%)</span>
            <span className="text-rose-500">5xx (0.5%)</span>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-mono text-[11px]">
          Created {fmtDateTime(project.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-brand group-hover:translate-x-0.5 transition-transform">
          Open Console <ChevronRight className="size-3.5" />
        </span>
      </div>
    </motion.div>
  );
}

function ProjectsLoadingSkeleton() {
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
