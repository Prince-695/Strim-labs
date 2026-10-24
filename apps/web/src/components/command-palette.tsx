"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Zap,
  Layers,
  ArrowLeftRight,
  Settings,
  Search,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Capacity Dashboard", category: "Navigation", icon: Layers },
  { href: "/runner", label: "Launch Load Test", category: "Load Testing", icon: Zap },
  { href: "/compare", label: "Run-to-Run Regression Studio", category: "Analysis", icon: ArrowLeftRight },
  { href: "/settings", label: "Organization & API Keys", category: "Settings", icon: Settings },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const filtered = query
    ? ITEMS.filter(
        (i) =>
          i.label.toLowerCase().includes(query.toLowerCase()) ||
          i.category.toLowerCase().includes(query.toLowerCase()),
      )
    : ITEMS;

  function select(item: NavItem) {
    onOpenChange(false);
    setQuery("");
    router.push(item.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick Search</DialogTitle>
        </DialogHeader>

        <div className="flex items-center px-4 border-b border-border/70 h-13">
          <Search className="size-4 text-muted-foreground mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to page... (ESC to close)"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none h-full"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-2 divide-y divide-border/40">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No matching pages found for "{query}".
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => select(item)}
                  className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-secondary/70 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-7 rounded-md bg-secondary flex items-center justify-center text-muted-foreground group-hover:text-brand transition-colors">
                      <Icon className="size-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-foreground block">{item.label}</span>
                      <span className="text-[10px] text-muted-foreground">{item.category}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
