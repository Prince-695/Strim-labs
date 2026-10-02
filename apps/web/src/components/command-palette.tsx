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
  KeyRound,
  Sparkles,
  CreditCard,
  Cpu,
  FileCode2,
  Search,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ITEMS: NavItem[] = [
  { href: "/runtime", label: "Runtime Overview", category: "Observability", icon: Activity },
  { href: "/topology", label: "Service Topology Graph", category: "Observability", icon: GitBranch },
  { href: "/requests", label: "Request Explorer & Traces", category: "Observability", icon: ListTree },
  { href: "/change-plans", label: "Change Plans & Canary Stepper", category: "Change Safety", icon: ScrollText },
  { href: "/simulations", label: "What-If Simulations Studio", category: "Change Safety", icon: FlaskConical },
  { href: "/load-tests", label: "Load Stress & Breaking Points", category: "Change Safety", icon: Cpu },
  { href: "/cache", label: "Edge Cache Intelligence", category: "Change Safety", icon: Database },
  { href: "/incidents", label: "Incidents & Rollback Center", category: "Governance", icon: Siren },
  { href: "/policies", label: "Policies & Runtime Drift", category: "Governance", icon: Shield },
  { href: "/audit", label: "Compliance Audit Logs", category: "Governance", icon: History },
  { href: "/applications", label: "Applications & Environments", category: "Admin", icon: AppWindow },
  { href: "/keys", label: "API Keys & Programmatic Scopes", category: "Admin", icon: KeyRound },
  { href: "/billing", label: "Billing, Invoices & SSO", category: "Admin", icon: CreditCard },
  { href: "/ai", label: "Grounded AI Copilot", category: "Intelligence", icon: Sparkles },
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

        {/* Search input header */}
        <div className="flex items-center px-4 border-b border-border/70 h-13">
          <Search className="size-4 text-muted-foreground mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to feature..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded-md border border-border px-1.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching pages or tools found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => select(item)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary/70 transition-colors text-left text-xs group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-lg bg-secondary text-foreground group-hover:bg-brand-pink/15 group-hover:text-brand-pink flex items-center justify-center transition-colors">
                      <Icon className="size-3.5" />
                    </div>
                    <span className="font-semibold text-foreground">{item.label}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-secondary/40 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Strim Navigation Engine</span>
          <div className="flex items-center gap-2">
            <span>Open API Docs:</span>
            <a
              href="http://localhost:8080/docs"
              target="_blank"
              rel="noreferrer"
              className="text-brand-pink hover:underline font-semibold"
            >
              /docs
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
