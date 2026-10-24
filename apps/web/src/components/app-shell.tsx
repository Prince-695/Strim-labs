"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap,
  Activity,
  BarChart3,
  ArrowLeftRight,
  Settings,
  Plus,
  LogOut,
  Menu,
  X,
  Target,
  BookOpen,
  Monitor,
  Sun,
  Moon,
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
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

import { AddTargetModal } from "@/components/add-target-modal";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/runner", label: "Load Runner", icon: Zap, accent: true },
  { href: "/compare", label: "Comparison", icon: ArrowLeftRight },
  { href: "/settings", label: "Settings", icon: Settings },
];

function ThemeSwitch() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-20 rounded-lg bg-secondary animate-pulse" />;

  const modes = [
    { value: "system" as const, icon: Monitor, label: "System" },
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
  ];

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary/80 border border-border/60">
      {modes.map((m) => {
        const Icon = m.icon;
        const active = theme === m.value;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => setTheme(m.value)}
            title={m.label}
            className={cn(
              "flex items-center justify-center size-7 rounded-md transition-all text-xs",
              active
                ? "bg-card text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const s = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addTargetOpen, setAddTargetOpen] = useState(false);

  useEffect(() => {
    if (!s.loading && !s.token) {
      router.replace("/login");
    }
  }, [s.loading, s.token, router]);

  const currentOrg = s.orgs.find((o) => o.id === s.orgId) ?? s.orgs[0];
  const currentProject = s.projects.find((p) => p.id === s.projectId) ?? s.projects[0];

  if (s.loading || !s.token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center animate-pulse">
            <Zap className="size-5" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading STRIM Engine…</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="p-4 border-b border-border/60 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="size-8 rounded-lg bg-brand text-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
            <Zap className="size-4" />
          </div>
          <div>
            <span className="font-heading font-bold text-sm tracking-tight text-foreground block leading-none">
              STRIM
            </span>
            <span className="text-[10px] text-muted-foreground leading-none">
              Load & Capacity Engine
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden size-8 rounded-lg text-muted-foreground hover:bg-secondary flex items-center justify-center"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Active API Target */}
      <div className="p-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Active Target
          </span>
          <button
            type="button"
            onClick={() => setAddTargetOpen(true)}
            className="flex items-center gap-0.5 text-[10px] font-semibold text-brand hover:text-brand-strong transition-colors cursor-pointer"
            title="Add Target API"
          >
            <Plus className="size-3" />
            Add
          </button>
        </div>
        <Select
          value={currentProject?.id ?? ""}
          onValueChange={(val) => {
            if (val) s.setProjectId(val);
          }}
        >
          <SelectTrigger className="w-full text-xs h-9 bg-secondary/60 border-border/60 rounded-lg">
            <SelectValue placeholder="Select target…" />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            {s.projects.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <Target className="size-3 text-muted-foreground shrink-0" />
                  {p.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentProject?.targetUrl && (
          <p className="text-[10px] font-mono text-muted-foreground truncate mt-1 px-1">
            {currentProject.targetUrl}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all group",
                active
                  ? "bg-brand-subtle text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-brand" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.accent && (
                <span className="relative flex size-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-brand" />
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-2 mt-2 border-t border-border/40">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-all"
          >
            <BookOpen className="size-4 shrink-0" />
            Documentation
          </a>
        </div>
      </div>

      {/* Footer: Org + Theme + Logout */}
      <div className="p-3 border-t border-border/60 space-y-2.5">
        <ThemeSwitch />
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="truncate">
            <p className="font-semibold text-foreground truncate">{currentOrg?.name ?? "Workspace"}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{currentOrg?.role?.toLowerCase() ?? "owner"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
            onClick={() => s.clear()}
            title="Sign out"
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
      <aside className="hidden md:flex w-60 flex-col border-r border-border/60 bg-card shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-background/80 backdrop-blur-sm">
          <div className="w-72 bg-card border-r border-border h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-3 border-b border-border/60 bg-card">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="size-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-brand flex items-center justify-center text-white">
              <Zap className="size-3.5" />
            </div>
            <span className="font-heading font-bold text-xs tracking-tight text-foreground">STRIM</span>
          </div>
          <ThemeSwitch />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <AddTargetModal open={addTargetOpen} onOpenChange={setAddTargetOpen} />
    </div>
  );
}
