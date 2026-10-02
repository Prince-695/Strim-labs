"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AppWindow,
  GitBranch,
  ListTree,
  FlaskConical,
  ScrollText,
  Database,
  Siren,
  Shield,
  History,
  Sparkles,
  KeyRound,
  LogOut,
  Search,
  ExternalLink,
  Cpu,
  CreditCard,
  Layers,
  ChevronRight,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";

type NavGroup = {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    pulse?: boolean;
    badge?: string;
  }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Observability",
    items: [
      { href: "/runtime", label: "Runtime Overview", icon: Activity, pulse: true },
      { href: "/topology", label: "Service Topology", icon: GitBranch },
      { href: "/requests", label: "Request Explorer", icon: ListTree },
    ],
  },
  {
    title: "Change Safety",
    items: [
      { href: "/change-plans", label: "Change Plans", icon: ScrollText },
      { href: "/simulations", label: "Simulations Studio", icon: FlaskConical },
      { href: "/load-tests", label: "Load & Stress Tests", icon: Cpu },
      { href: "/cache", label: "Cache Intelligence", icon: Database },
    ],
  },
  {
    title: "Governance",
    items: [
      { href: "/incidents", label: "Incidents & Rollbacks", icon: Siren, badge: "Live" },
      { href: "/policies", label: "Policies & Drift", icon: Shield },
      { href: "/audit", label: "Compliance Audit", icon: History },
    ],
  },
  {
    title: "Developer & Admin",
    items: [
      { href: "/applications", label: "Apps & Environments", icon: AppWindow },
      { href: "/keys", label: "API Keys & Scopes", icon: KeyRound },
      { href: "/billing", label: "Billing & SSO", icon: CreditCard },
      { href: "/ai", label: "AI Copilot", icon: Sparkles, badge: "Beta" },
    ],
  },
];

function onSelect(setter: (id: string) => void) {
  return (value: string | null) => {
    if (value) setter(value);
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const s = useSession();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!s.loading && !s.token) {
      router.replace("/login");
    }
  }, [s.loading, s.token, router]);

  const workspaces = s.workspaces;
  const currentWorkspace = workspaces.find((w) => w.id === s.workspaceId) ?? workspaces[0];
  const projects = currentWorkspace?.projects ?? [];
  const currentProject = projects.find((p) => p.id === s.projectId) ?? projects[0];
  const apps = currentProject?.applications ?? [];
  const currentApp = apps.find((a) => a.id === s.applicationId) ?? apps[0];
  const envs = currentApp?.environments ?? [];
  const currentEnv = envs.find((e) => e.id === s.environmentId) ?? envs[0];

  const currentOrg = s.orgs.find((o) => o.id === s.orgId) ?? s.orgs[0];

  if (s.loading || !s.token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-2xl bg-brand-pink/15 text-brand-pink flex items-center justify-center animate-pulse">
            <Layers className="size-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing Strim workspace…</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="p-4 border-b border-border/70 flex items-center justify-between">
        <Link href="/runtime" className="flex items-center gap-2.5 group">
          <div className="size-8 rounded-xl bg-gradient-to-tr from-brand-pink to-brand-gold flex items-center justify-center text-white shadow-md shadow-brand-pink/20 transition-transform group-hover:scale-105">
            <Zap className="size-4 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-black text-sm tracking-tight text-foreground">STRIM</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                v1.2
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Safe Change Engine</p>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden size-8 rounded-lg text-muted-foreground hover:bg-secondary flex items-center justify-center"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <h4 className="px-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              {group.title}
            </h4>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = path === item.href || (item.href !== "/runtime" && path.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition-all group",
                      active
                        ? "bg-secondary text-foreground font-bold border border-border/80 shadow-2xs"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-transform group-hover:scale-110",
                          active ? "text-brand-pink" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span>{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.pulse && (
                        <span className="relative flex size-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
                          <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                        </span>
                      )}
                      {item.badge && (
                        <span
                          className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full",
                            active
                              ? "bg-brand-pink/10 text-brand-pink border border-brand-pink/30"
                              : "bg-secondary text-muted-foreground border border-border"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {/* User Session Footer */}
      <div className="p-3 bg-secondary/30">
        <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/70 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-full bg-gradient-to-tr from-brand-pink to-brand-gold text-white font-bold text-xs flex items-center justify-center shrink-0">
              {currentOrg?.name?.slice(0, 1).toUpperCase() || "S"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{currentOrg?.name || "Strim Member"}</p>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground capitalize truncate">
                  {currentOrg?.role || "Member"}
                </span>
                <span className="text-[10px] text-muted-foreground">•</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Active</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              s.clear();
              router.replace("/login");
            }}
            title="Sign out"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card text-card-foreground shrink-0 shadow-2xs">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex w-72 flex-col border-r border-border bg-card text-card-foreground shadow-2xl z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 backdrop-blur-md px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden size-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Menu className="size-4" />
            </button>

            {/* Hierarchical Context Selectors */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Org Select */}
              <Select value={s.orgId ?? ""} onValueChange={onSelect(s.setOrgId)}>
                <SelectTrigger size="sm" className="h-8 max-w-[150px] text-xs font-semibold rounded-lg bg-secondary/50 border-border/80 hover:bg-secondary">
                  <span className="truncate">{currentOrg?.name || "Organization"}</span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border bg-card shadow-lg text-xs">
                  {s.orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id} className="text-xs">
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />

              {/* Workspace Select */}
              <Select value={s.workspaceId ?? ""} onValueChange={onSelect(s.setWorkspaceId)}>
                <SelectTrigger size="sm" className="h-8 max-w-[140px] text-xs font-medium rounded-lg bg-secondary/50 border-border/80 hover:bg-secondary">
                  <span className="truncate">{currentWorkspace?.name || "Workspace"}</span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border bg-card shadow-lg text-xs">
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id} className="text-xs">
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />

              {/* Project Select */}
              <Select value={s.projectId ?? ""} onValueChange={onSelect(s.setProjectId)}>
                <SelectTrigger size="sm" className="h-8 max-w-[140px] text-xs font-medium rounded-lg bg-secondary/50 border-border/80 hover:bg-secondary">
                  <span className="truncate">{currentProject?.name || "Project"}</span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-border bg-card shadow-lg text-xs">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ChevronRight className="size-3 text-muted-foreground/60 shrink-0 hidden sm:block" />

              {/* App Select */}
              <div className="hidden sm:block">
                <Select value={s.applicationId ?? ""} onValueChange={onSelect(s.setApplicationId)}>
                  <SelectTrigger size="sm" className="h-8 max-w-[150px] text-xs font-medium rounded-lg bg-secondary/50 border-border/80 hover:bg-secondary">
                    <span className="truncate">{currentApp?.name || "Application"}</span>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border bg-card shadow-lg text-xs">
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ChevronRight className="size-3 text-muted-foreground/60 shrink-0 hidden lg:block" />

              {/* Env Select */}
              <div className="hidden lg:block">
                <Select value={s.environmentId ?? ""} onValueChange={onSelect(s.setEnvironmentId)}>
                  <SelectTrigger size="sm" className="h-8 max-w-[130px] text-xs font-medium rounded-lg bg-secondary/50 border-border/80 hover:bg-secondary">
                    <span className="truncate">{currentEnv?.name || "Environment"}</span>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border bg-card shadow-lg text-xs">
                    {envs.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Environment Type Badge */}
              {currentEnv && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full hidden md:inline-flex",
                    currentEnv.type === "PRODUCTION"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {currentEnv.type}
                </Badge>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {/* Quick Search Button */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 h-8 rounded-full border border-border/80 bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground transition-colors cursor-pointer"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline-flex h-4 items-center rounded border border-border px-1 text-[9px] font-mono font-semibold">
                ⌘K
              </kbd>
            </button>

            {/* Health Score Pill */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Score: 98</span>
              <span className="text-[10px] font-normal text-emerald-600/80 dark:text-emerald-400/80">Nominal</span>
            </div>

            {/* API Docs Button */}
            <a
              href="http://localhost:8080/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 h-8 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <span>API Docs</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-background">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
