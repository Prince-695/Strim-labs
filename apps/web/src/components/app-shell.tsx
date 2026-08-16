"use client";

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
  LogOut,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const NAV = [
  { href: "/runtime", label: "Runtime", icon: Activity },
  { href: "/applications", label: "Applications", icon: AppWindow },
  { href: "/requests", label: "Requests", icon: ListTree },
  { href: "/topology", label: "Topology", icon: GitBranch },
  { href: "/simulations", label: "Simulations", icon: FlaskConical },
  { href: "/change-plans", label: "Change Plans", icon: ScrollText },
  { href: "/cache", label: "Cache", icon: Database },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/policies", label: "Policies", icon: Shield },
  { href: "/audit", label: "Audit", icon: History },
  { href: "/ai", label: "AI", icon: Sparkles },
] as const;

function onSelect(setter: (id: string) => void) {
  return (value: string | null) => {
    if (value) setter(value);
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const s = useSession();

  useEffect(() => {
    if (!s.loading && !s.token) router.replace("/");
  }, [s.loading, s.token, router]);

  const workspaces = s.workspaces;
  const projects = workspaces.find((w) => w.id === s.workspaceId)?.projects ?? [];
  const apps = projects.find((p) => p.id === s.projectId)?.applications ?? [];
  const envs = apps.find((a) => a.id === s.applicationId)?.environments ?? [];

  if (s.loading || !s.token) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-5">
          <div className="text-xs font-semibold tracking-[0.2em] text-muted-foreground">STRIM</div>
          <div className="mt-1 text-sm text-muted-foreground">Runtime intelligence</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/70",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Separator />
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              s.clear();
              router.replace("/");
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Select value={s.orgId ?? ""} onValueChange={onSelect(s.setOrgId)}>
            <SelectTrigger className="min-w-36">
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              {s.orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.workspaceId ?? ""} onValueChange={onSelect(s.setWorkspaceId)}>
            <SelectTrigger className="min-w-32">
              <SelectValue placeholder="Workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.projectId ?? ""} onValueChange={onSelect(s.setProjectId)}>
            <SelectTrigger className="min-w-32">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.applicationId ?? ""} onValueChange={onSelect(s.setApplicationId)}>
            <SelectTrigger className="min-w-36">
              <SelectValue placeholder="Application" />
            </SelectTrigger>
            <SelectContent>
              {apps.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={s.environmentId ?? ""} onValueChange={onSelect(s.setEnvironmentId)}>
            <SelectTrigger className="min-w-32">
              <SelectValue placeholder="Environment" />
            </SelectTrigger>
            <SelectContent>
              {envs.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
