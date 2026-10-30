"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  Activity,
  Layers,
  Server,
  Zap,
  Target,
  BarChart3,
  Bell,
  AlertOctagon,
  Settings,
  Shield,
  Users,
  Key,
  Webhook,
  FileText,
  PieChart,
  ChevronDown,
  Plus,
  Compass,
  Menu,
  X,
  ExternalLink,
  LogOut,
  FolderPlus,
  Building,
  Terminal,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CircularThemeToggle } from "../circular-theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const { isReady, isAuthenticated, token, user, orgs, currentOrg, currentOrgId, switchOrg, logout } = useAuth();

  const urlOrgId = (params?.orgId as string) || currentOrgId || orgs[0]?.id;
  const urlProjectId = params?.projectId as string | undefined;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Guard: redirect to sign-in if unauthenticated
  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isReady, isAuthenticated, router, pathname]);

  // Query projects for the current organization
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: urlOrgId ? queryKeys.projects.all(urlOrgId) : ["no-org"],
    enabled: Boolean(token && urlOrgId),
    queryFn: async () => {
      const res = await fetchApi<{ projects: Schemas["Project"][]; maxProjects?: number } | Schemas["Project"][]>(
        `/api/v1/organizations/${urlOrgId}/projects`
      );
      if (Array.isArray(res)) return res;
      if (res && typeof res === "object" && Array.isArray((res as any).projects)) {
        return (res as any).projects as Schemas["Project"][];
      }
      return [] as Schemas["Project"][];
    },
  });

  const projects = useMemo<Schemas["Project"][]>(() => {
    if (Array.isArray(projectsData)) return projectsData;
    if (projectsData && typeof projectsData === "object" && Array.isArray((projectsData as any).projects)) {
      return (projectsData as any).projects as Schemas["Project"][];
    }
    return [];
  }, [projectsData]);

  const currentProject = (Array.isArray(projects) && projects.length > 0)
    ? (projects.find((p) => p?.id === urlProjectId) || projects[0] || null)
    : null;
  const activeProjectId = urlProjectId || currentProject?.id;

  // Close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  // Project navigation links
  const projectNavItems = urlOrgId && activeProjectId ? [
    {
      title: "Project Overview",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}`,
      icon: Layers,
      exact: true,
    },
    {
      title: "Services & APIs",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/services`,
      icon: Server,
    },
    {
      title: "Observability",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/monitoring`,
      icon: Activity,
    },
    {
      title: "Dashboards",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/dashboards`,
      icon: BarChart3,
    },
    {
      title: "Alerts & Rules",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/alerts`,
      icon: Bell,
    },
    {
      title: "Incidents",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/incidents`,
      icon: AlertOctagon,
    },
    {
      title: "Load Testing",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/load-tests`,
      icon: Zap,
    },
    {
      title: "Diagnostics & Regressions",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/diagnostics`,
      icon: Target,
    },
    {
      title: "Project Settings",
      href: `/app/organizations/${urlOrgId}/projects/${activeProjectId}/settings`,
      icon: Settings,
    },
  ] : [];

  // Organization-level navigation links
  const orgNavItems = urlOrgId ? [
    {
      title: "Projects",
      href: `/app/organizations/${urlOrgId}/projects`,
      icon: Layers,
      exact: true,
    },
    {
      title: "Team Members",
      href: `/app/organizations/${urlOrgId}/members`,
      icon: Users,
    },
    {
      title: "API Keys",
      href: `/app/organizations/${urlOrgId}/api-keys`,
      icon: Key,
    },
    {
      title: "Integrations & Webhooks",
      href: `/app/organizations/${urlOrgId}/integrations`,
      icon: Webhook,
    },
    {
      title: "Audit Trail",
      href: `/app/organizations/${urlOrgId}/audit-logs`,
      icon: FileText,
    },
    {
      title: "Quotas & Usage",
      href: `/app/organizations/${urlOrgId}/usage`,
      icon: PieChart,
    },
    {
      title: "Org Settings",
      href: `/app/organizations/${urlOrgId}/settings`,
      icon: Settings,
    },
  ] : [];

  const isProjectView = Boolean(urlProjectId);

  const userInitials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-transform duration-200 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand & Org Switcher Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link href="/app" className="flex items-center gap-2 group">
            <div className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-xs">
              <Activity className="size-4" />
            </div>
            <span className="font-bold tracking-tight text-foreground text-sm">
              STRIM<span className="text-brand font-mono text-[10px] ml-1">LABS</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Workspace Switchers */}
        <div className="p-3 border-b border-border space-y-2">
          {/* Organization Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted/60 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted transition-colors outline-none">
              <div className="flex items-center gap-2 truncate">
                <Building className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{currentOrg?.name || "Select Organization"}</span>
              </div>
              <ChevronDown className="size-3 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Organizations ({orgs.length}/3)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orgs.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  onClick={() => {
                    switchOrg(o.id);
                    router.push(`/app/organizations/${o.id}`);
                  }}
                  className={cn("text-xs flex items-center justify-between", o.id === urlOrgId && "font-semibold text-brand")}
                >
                  <span className="truncate">{o.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{o.plan}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {orgs.length < 3 ? (
                <DropdownMenuItem
                  onClick={() => router.push("/app/organizations/new")}
                  className="text-xs text-brand font-medium flex items-center gap-2"
                >
                  <Plus className="size-3.5" /> New Organization
                </DropdownMenuItem>
              ) : (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  Org limit reached (3/3)
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Project Switcher */}
          {urlOrgId && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-muted transition-colors outline-none">
                <div className="flex items-center gap-2 truncate">
                  <Layers className="size-3.5 text-brand shrink-0" />
                  <span className="truncate font-medium">
                    {currentProject?.name || (projectsLoading ? "Loading projects..." : "Select Project")}
                  </span>
                </div>
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Projects ({projects.length}/5)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map((p: Schemas["Project"]) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => {
                      router.push(`/app/organizations/${urlOrgId}/projects/${p.id}`);
                    }}
                    className={cn("text-xs", p.id === activeProjectId && "font-semibold text-brand")}
                  >
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
                {projects.length === 0 && !projectsLoading && (
                  <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                    No projects yet
                  </div>
                )}
                <DropdownMenuSeparator />
                {projects.length < 5 ? (
                  <DropdownMenuItem
                    onClick={() => router.push(`/app/organizations/${urlOrgId}/projects/new`)}
                    className="text-xs text-brand font-medium flex items-center gap-2"
                  >
                    <FolderPlus className="size-3.5" /> New Project
                  </DropdownMenuItem>
                ) : (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    Project cap reached (5/5)
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Project View Nav */}
          {isProjectView ? (
            <div className="space-y-1">
              <div className="px-2 pb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                Project Console
              </div>
              {projectNavItems.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand font-semibold"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}

              <div className="pt-4 px-2 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                Organization Scope
              </div>
              <Link
                href={`/app/organizations/${urlOrgId}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
              >
                <Building className="size-3.5" />
                <span>Switch to Org View</span>
              </Link>
            </div>
          ) : (
            /* Organization View Nav */
            <div className="space-y-1">
              <div className="px-2 pb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                Organization
              </div>
              {orgNavItems.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand font-semibold"
                        : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer: User profile & settings */}
        <div className="border-t border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-surface-muted transition-colors outline-none">
              <Avatar className="size-8">
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <div className="text-xs font-semibold text-foreground truncate">{user?.name || "Developer"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Account &amp; Preferences</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/app/settings/profile")} className="text-xs">
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/app/settings/security")} className="text-xs">
                Security &amp; Sessions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/app/settings/preferences")} className="text-xs">
                Preferences
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/app/settings/notifications")} className="text-xs">
                Notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-xs text-rose-500 font-medium">
                <LogOut className="mr-2 size-3.5" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 sm:px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>

            {/* Breadcrumb Info */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {currentOrg && (
                <>
                  <Link
                    href={`/app/organizations/${currentOrg.id}`}
                    className="hover:text-foreground transition-colors font-medium truncate max-w-[120px] sm:max-w-none"
                  >
                    {currentOrg.name}
                  </Link>
                  {currentProject && (
                    <>
                      <span>/</span>
                      <Link
                        href={`/app/organizations/${currentOrg.id}/projects/${currentProject.id}`}
                        className="hover:text-foreground transition-colors font-medium text-foreground truncate max-w-[120px] sm:max-w-none"
                      >
                        {currentProject.name}
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* API Docs quick link */}
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Terminal className="size-3.5" />
              <span>API Specs</span>
              <ExternalLink className="size-3 opacity-60" />
            </a>

            {/* Theme Toggle */}
            <CircularThemeToggle />
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
