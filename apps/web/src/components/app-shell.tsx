"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  Building2,
  Check,
  ChevronsUpDown,
  Layers,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SPRING_SNAPPY } from "@/lib/motion";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { AddTargetModal } from "./add-target-modal";
import { AppHeader } from "./app-header";
import { CommandPalette } from "./command-palette";
import { CreateOrgModal } from "./create-org-modal";
import { Logo, LogoMark } from "./logo";
import { Skeleton } from "./ui/skeleton";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/projects", label: "Projects", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/docs", label: "Documentation", icon: BookOpen },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/projects/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, token, org, orgs, setOrgId } = useSession();

  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [orgMenu, setOrgMenu] = useState(false);

  // Restore sidebar collapse state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("strim_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("strim_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Guard: require session
  useEffect(() => {
    if (ready && !token) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, token, router, pathname]);

  useEffect(() => setDrawer(false), [pathname]);

  if (!ready || !token) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading console">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }

  const orgInitial = (org?.name || "O").slice(0, 1).toUpperCase();

  const renderSidebar = (isCollapsed: boolean, isDrawer = false) => (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className={cn("flex h-16 items-center px-4", isCollapsed ? "justify-center" : "justify-between px-5")}>
        <Link href="/dashboard" aria-label="STRIM Labs dashboard">
          {isCollapsed ? <LogoMark className="size-9 p-0.5" /> : <Logo />}
        </Link>
        {isDrawer && (
          <button
            type="button"
            onClick={() => setDrawer(false)}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted md:hidden"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Organization Switcher Dropdown */}
      <div className={cn("relative", isCollapsed ? "px-2" : "px-3")}>
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => setOrgMenu((o) => !o)}
            title={`Organization: ${org?.name || "Select Org"}`}
            aria-label="Switch organization"
            className="mx-auto flex size-10 items-center justify-center rounded-xl border border-border bg-surface-muted/60 font-semibold text-xs text-foreground transition-colors hover:bg-surface-muted"
          >
            {orgInitial}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOrgMenu((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={orgMenu}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-2 text-left transition-colors hover:bg-surface-muted"
          >
            <div className="grid size-6 place-items-center rounded-lg bg-brand text-xs font-bold text-brand-foreground shadow-xs shrink-0">
              {orgInitial}
            </div>
            <div className="min-w-0 flex-1">
              <span className="truncate text-[13px] font-semibold text-foreground block">
                {org?.name || "Select Org"}
              </span>
              <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                {org?.role || "OWNER"} WORKSPACE
              </p>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}

        <AnimatePresence>
          {orgMenu && (
            <>
              <button
                type="button"
                aria-label="Close organization menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setOrgMenu(false)}
              />
              <motion.div
                role="listbox"
                aria-label="Organizations"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className={cn(
                  "z-40 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl",
                  isCollapsed
                    ? "absolute left-full top-0 ml-2 w-64"
                    : "absolute inset-x-3 top-full mt-1.5"
                )}
              >
                <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Organizations</span>
                  <span className="font-mono">{orgs.length} / 3</span>
                </div>

                <div className="space-y-0.5 mt-1">
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={o.id === org?.id}
                      onClick={() => {
                        setOrgId(o.id);
                        setOrgMenu(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-muted text-xs",
                        o.id === org?.id && "bg-brand-subtle text-brand-foreground font-semibold"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{o.name}</span>
                      </div>
                      {o.id === org?.id && <Check className="size-3.5 text-brand shrink-0" />}
                    </button>
                  ))}
                </div>

                <div className="border-t border-border mt-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOrgMenu(false);
                      setCreateOrgOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    <span>Create organization</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Search */}
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="Search or command palette (⌘K)"
          aria-label="Search"
          className="mx-auto mt-3 flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Search className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Search className="size-3.5" /> Search
          <kbd className="ml-auto rounded border border-border px-1.5 py-px font-mono text-[10px]">⌘K</kbd>
        </button>
      )}

      {/* Primary Navigation */}
      <nav aria-label="Primary" className={cn("mt-4 flex-1 space-y-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);

          if (isCollapsed) {
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative mx-auto flex size-10 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-brand-subtle text-brand-strong dark:text-brand shadow-xs"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                <Icon className="size-5" aria-hidden />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:bg-surface-muted/70 hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={SPRING_SNAPPY}
                  className="absolute inset-0 rounded-lg bg-brand-subtle"
                />
              )}
              {active && (
                <motion.span
                  layoutId="nav-bar"
                  transition={SPRING_SNAPPY}
                  className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-brand"
                />
              )}
              <Icon className={cn("relative size-4", active && "text-brand-strong dark:text-brand")} aria-hidden />
              <span className="relative flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div
      className={cn(
        "min-h-dvh transition-[padding-left] duration-200 ease-in-out",
        collapsed ? "md:pl-[72px]" : "md:pl-[260px]"
      )}
    >
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden border-r border-border bg-card transition-[width] duration-200 ease-in-out md:block",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        {renderSidebar(collapsed, false)}
      </aside>

      {/* Top Application Navbar */}
      <AppHeader
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onOpenDrawer={() => setDrawer(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              aria-hidden
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-card shadow-2xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              {renderSidebar(false, true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </main>

      <AddTargetModal open={addOpen} onOpenChange={setAddOpen} />
      <CreateOrgModal open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onAddTarget={() => setAddOpen(true)} />
    </div>
  );
}
