"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CircularThemeToggle } from "./circular-theme-toggle";
import { Badge } from "./ui/badge";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects & Services",
  "/settings": "Workspace Settings",
  "/docs": "Documentation",
};

export function AppHeader({
  collapsed,
  onToggleCollapse,
  onOpenDrawer,
  onOpenPalette,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenDrawer?: () => void;
  onOpenPalette: () => void;
  onAddTarget?: () => void;
}) {
  const pathname = usePathname();
  const { org, user, clear } = useSession();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on page route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const activeTitle =
    TITLES[pathname] ??
    (pathname.startsWith("/projects/")
      ? "Project Console"
      : pathname.startsWith("/tests/")
      ? "Test Report"
      : "STRIM Labs");

  const displayName = user?.name || "Priya";
  const displayEmail = user?.email || "priya@acme.test";
  const userInitials = (displayName || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      {/* Left section: Collapse button + Page Title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        {onOpenDrawer && (
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open navigation"
            className="grid place-items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground md:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}

        {/* Desktop sidebar collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground md:grid place-items-center"
        >
          {collapsed ? <PanelLeftOpen className="size-4.5" /> : <PanelLeftClose className="size-4.5" />}
        </button>

        <div className="h-4 w-px bg-border hidden md:block" />

        {/* Current Section Title */}
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          {activeTitle}
        </h1>
      </div>

      {/* Right section: Search + Circular Theme Toggle + User Profile Dropdown */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Quick Search */}
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Search or command palette"
          className="hidden items-center gap-2 rounded-full border border-border bg-surface-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground md:flex"
        >
          <Search className="size-3.5" />
          <span>Search...</span>
          <kbd className="rounded border border-border px-1 text-[10px]">⌘K</kbd>
        </button>

        {/* Circular Theme Toggle */}
        <CircularThemeToggle />

        {/* User Profile Dropdown */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="User Profile Menu"
            className="flex items-center gap-2 rounded-full border border-border bg-surface-muted/60 p-1 pr-2.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="grid size-7 place-items-center rounded-full bg-brand text-xs font-bold text-brand-foreground shadow-xs">
              {userInitials}
            </div>
            <span className="max-w-[110px] truncate text-xs font-semibold text-foreground hidden sm:block">
              {displayName}
            </span>
            <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", menuOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-card p-2 shadow-2xl z-50"
              >
                {/* Header Profile summary */}
                <div className="border-b border-border px-3 pb-2.5 pt-2">
                  <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{displayEmail}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {org?.name ? `${org.name} • ${org.role || "OWNER"}` : "Active Session"}
                    </span>
                  </div>
                </div>

                {/* Navigation items */}
                <div className="py-1 space-y-0.5">
                  <Link
                    href="/settings?tab=profile"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
                  >
                    <User className="size-4 text-muted-foreground" />
                    <span>Profile settings</span>
                  </Link>

                  <Link
                    href="/settings?tab=org"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted"
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    <span>Organization settings</span>
                  </Link>

                  <Link
                    href="/docs"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    <ExternalLink className="size-4 text-muted-foreground" />
                    <span>Documentation & API</span>
                  </Link>
                </div>

                {/* Sign out */}
                <div className="border-t border-border pt-1">
                  <button
                    type="button"
                    onClick={clear}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-danger-text transition-colors hover:bg-danger-subtle"
                  >
                    <LogOut className="size-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
