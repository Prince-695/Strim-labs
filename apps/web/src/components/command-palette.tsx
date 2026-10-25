"use client";

import { BarChart3, BookOpen, CornerDownLeft, Crosshair, Layers, LogOut, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";
import { Dialog } from "./ui/dialog";

type Command = { id: string; label: string; hint?: string; icon: ReactNode; run: () => void; group: string };

export function CommandPalette({ open, onOpenChange, onAddTarget }: { open: boolean; onOpenChange: (o: boolean) => void; onAddTarget: () => void }) {
  const router = useRouter();
  const { projects, projectId, setProjectId, clear } = useSession();
  const { resolved, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const base: Command[] = [
      { id: "dash", label: "Executive Dashboard", icon: <BarChart3 />, run: go("/dashboard"), group: "Navigate" },
      { id: "projects", label: "All Projects", icon: <Layers />, run: go("/projects"), group: "Navigate" },
      { id: "settings", label: "Profile & Org Settings", icon: <Settings />, run: go("/settings"), group: "Navigate" },
      { id: "docs", label: "Documentation", icon: <BookOpen />, run: go("/docs"), group: "Navigate" },
      { id: "add", label: "Add new project", icon: <Plus />, run: onAddTarget, group: "Actions" },
      {
        id: "theme",
        label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolved === "dark" ? <Sun /> : <Moon />,
        run: () => setTheme(resolved === "dark" ? "light" : "dark"),
        group: "Actions",
      },
      { id: "out", label: "Sign out", icon: <LogOut />, run: clear, group: "Actions" },
    ];
    const targets: Command[] = projects.map((p) => ({
      id: `p-${p.id}`,
      label: `Switch target: ${p.name}`,
      hint: p.id === projectId ? "Active" : p.targetUrl,
      icon: <Crosshair />,
      run: () => setProjectId(p.id),
      group: "Targets",
    }));
    return [...base, ...targets];
  }, [router, projects, projectId, setProjectId, onAddTarget, resolved, setTheme, clear]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  useEffect(() => setActive(0), [query, open]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function runAt(i: number) {
    const cmd = filtered[i];
    if (!cmd) return;
    onOpenChange(false);
    setTimeout(cmd.run, 60);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Command palette" hideHeader align="top" className="max-w-xl p-0 [&>div:nth-child(2)]:p-0">
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(filtered.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runAt(active);
            }
          }}
          placeholder="Search pages, targets and actions…"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">esc</kbd>
      </div>
      <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
        {filtered.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</li>}
        {filtered.map((c, i) => {
          const showGroup = i === 0 || filtered[i - 1].group !== c.group;
          return (
            <li key={c.id} role="presentation">
              {showGroup && <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">{c.group}</p>}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                data-index={i}
                onMouseMove={() => setActive(i)}
                onClick={() => runAt(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors [&_svg]:size-4 [&_svg]:text-muted-foreground",
                  i === active && "bg-brand-subtle text-foreground [&_svg]:text-brand-strong dark:[&_svg]:text-brand",
                )}
              >
                {c.icon}
                <span className="flex-1 truncate">{c.label}</span>
                {c.hint && <span className="max-w-48 truncate font-mono text-xs text-muted-foreground">{c.hint}</span>}
                {i === active && <CornerDownLeft className="!size-3.5" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
