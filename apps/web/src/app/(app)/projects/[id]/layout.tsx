"use client";

import {
  Activity,
  ArrowLeft,
  Calendar,
  Compass,
  ExternalLink,
  Flame,
  Globe,
  History,
  Key,
  Layers,
  Radio,
  Settings,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { hostOf } from "@/lib/format";
import { useSession } from "@/lib/session";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectConsoleLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { projects, setProjectId, org } = useSession();

  const projectId = params?.id;
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  // Synchronize active project in session
  useEffect(() => {
    if (projectId) {
      setProjectId(projectId);
    }
  }, [projectId, setProjectId]);

  const tabs = [
    {
      href: `/projects/${projectId}`,
      exact: true,
      label: "Observability",
      icon: Activity,
    },
    {
      href: `/projects/${projectId}/runner`,
      exact: false,
      label: "Breakpoint Runner",
      icon: Zap,
    },
    {
      href: `/projects/${projectId}/tests`,
      exact: false,
      label: "Test History",
      icon: History,
    },
    {
      href: `/projects/${projectId}/explorer`,
      exact: false,
      label: "API Explorer",
      icon: Compass,
      badge: project?._count?.discoveredRoutes ? `${project._count.discoveredRoutes}` : undefined,
    },
    {
      href: `/projects/${projectId}/settings`,
      exact: false,
      label: "Settings",
      icon: Settings,
    },
  ];

  const renderStatus = () => {
    const status = project?.status || "PENDING_SDK";
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Healthy Production
          </span>
        );
      case "DEGRADED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
            <span className="size-2 rounded-full bg-amber-500" />
            Degraded Performance
          </span>
        );
      case "INCIDENT":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-500 border border-rose-500/20">
            <span className="size-2 rounded-full bg-rose-500 animate-ping" />
            Incident Alert
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-medium text-neutral-400 border border-neutral-500/20">
            <span className="size-2 rounded-full bg-neutral-400" />
            Pending SDK Telemetry
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back Link */}
      <div className="flex flex-col gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" /> Back to All Projects
        </Link>

        {/* Project Title Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {project ? project.name : <Skeleton className="h-8 w-48 inline-block" />}
              </h1>
              {renderStatus()}
            </div>
            {project && (
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <a
                  href={project.baseUrl || project.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono hover:text-foreground transition-colors"
                >
                  <Globe className="size-3.5" />
                  {hostOf(project.baseUrl || project.targetUrl)}
                  <ExternalLink className="size-3 opacity-60" />
                </a>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Key className="size-3 text-brand" /> {project.apiKeyPrefix || "strim_live_"}••••••••
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Sub-Navigation Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-px" aria-label="Project tabs">
          {tabs.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "border-brand text-brand-strong dark:text-brand font-semibold"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
                {tab.badge && (
                  <span className="rounded-full bg-surface-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Tab Content */}
      <div className="pt-2">{children}</div>
    </div>
  );
}
