"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Search,
  ShieldAlert,
  Sliders,
  Terminal,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DiscoveredRoute {
  id: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  status: number;
  latencyMs: number;
  rps: number;
  healthy: boolean;
  zone: "Safe Band" | "Saturation Knee" | "Breaking Cliff";
  bottleneck: string;
  notes: string;
}

const DISCOVERED_ROUTES: DiscoveredRoute[] = [
  {
    id: "checkout",
    path: "/api/checkout/process",
    method: "POST",
    status: 200,
    latencyMs: 34,
    rps: 420,
    healthy: true,
    zone: "Safe Band",
    bottleneck: "Optimal throughput scaling 1:1 with load.",
    notes: "Postgres transaction time: 14ms. Stripe idempotency cache hit.",
  },
  {
    id: "auth",
    path: "/v1/auth/session/refresh",
    method: "POST",
    status: 200,
    latencyMs: 18,
    rps: 512,
    healthy: true,
    zone: "Safe Band",
    bottleneck: "Zero worker queueing. Flat latency curve.",
    notes: "Redis session verification within 2ms.",
  },
  {
    id: "inventory",
    path: "/api/inventory/items",
    method: "GET",
    status: 200,
    latencyMs: 42,
    rps: 340,
    healthy: true,
    zone: "Safe Band",
    bottleneck: "Read replica query latency remains sub-50ms.",
    notes: "Multi-row index scan with 99.4% cache hit ratio.",
  },
  {
    id: "heartbeat",
    path: "/v1/telemetry/heartbeat",
    method: "GET",
    status: 200,
    latencyMs: 8,
    rps: 890,
    healthy: true,
    zone: "Safe Band",
    bottleneck: "In-memory atomic ring buffer heartbeat.",
    notes: "Non-blocking Bun event loop micro-tick.",
  },
  {
    id: "profile",
    path: "/api/users/profile/update",
    method: "PUT",
    status: 200,
    latencyMs: 88,
    rps: 210,
    healthy: true,
    zone: "Saturation Knee",
    bottleneck: "Downstream DB connection pool approaching 85% capacity.",
    notes: "Unindexed WHERE clause on account_metadata column.",
  },
  {
    id: "webhooks",
    path: "/api/webhooks/inbound",
    method: "POST",
    status: 504,
    latencyMs: 1240,
    rps: 64,
    healthy: false,
    zone: "Breaking Cliff",
    bottleneck: "Downstream third-party HTTP timeout triggered cascading 504.",
    notes: "Worker threads saturated waiting for external webhook ACK.",
  },
];

export function SolutionDiscovery() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "healthy" | "issues" | "post">("all");
  const [selectedRoute, setSelectedRoute] = useState<string>("webhooks");

  const filtered = DISCOVERED_ROUTES.filter((r) => {
    if (query && !r.path.toLowerCase().includes(query.toLowerCase()) && !r.bottleneck.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    if (filter === "healthy") return r.healthy;
    if (filter === "issues") return !r.healthy;
    if (filter === "post") return r.method === "POST";
    return true;
  });

  const active = DISCOVERED_ROUTES.find((r) => r.id === selectedRoute) || DISCOVERED_ROUTES[0];

  return (
    <section id="discovery" className="relative overflow-hidden pt-8 pb-20 sm:pt-12 sm:pb-28">
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-5xl lg:text-[52px] leading-[1.08]">
            You can find them in one place now
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            STRIM catches every route automatically. Query endpoints in plain language, filter by latency cliff or error ratios, and inspect the exact bottleneck.
          </p>
        </div>

        {/* ── Shelf-Inspired Command Palette / Search Discovery Box ── */}
        <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-[24px] border border-border bg-card shadow-xl backdrop-blur-xl">
          {/* Natural Language / Route Search Bar */}
          <div className="flex items-center gap-3 border-b border-border bg-surface-muted/30 px-5 py-4">
            <Search className="size-5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter routes by path, error status, or bottleneck..."
              className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Extracted Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-surface-muted/15 px-5 py-3">
            <span className="text-xs text-muted-foreground mr-1">Filter:</span>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-foreground text-background font-semibold"
                  : "bg-surface-muted text-muted-foreground hover:text-foreground"
              )}
            >
              All Routes ({DISCOVERED_ROUTES.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("issues")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "issues"
                  ? "bg-destructive text-white font-semibold"
                  : "bg-danger-subtle text-danger-text hover:bg-destructive/20"
              )}
            >
              Issues &amp; 504s (1)
            </button>
            <button
              type="button"
              onClick={() => setFilter("healthy")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "healthy"
                  ? "bg-brand text-brand-foreground font-semibold"
                  : "bg-brand-subtle text-brand hover:bg-brand/20"
              )}
            >
              Healthy Safe Band (4)
            </button>
            <button
              type="button"
              onClick={() => setFilter("post")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                filter === "post"
                  ? "bg-foreground text-background font-semibold"
                  : "bg-surface-muted text-muted-foreground hover:text-foreground"
              )}
            >
              POST Methods (3)
            </button>
          </div>

          {/* Live Discovered Route Result Cards */}
          <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto">
            {filtered.map((route) => {
              const isSelected = route.id === selectedRoute;
              return (
                <div
                  key={route.id}
                  onClick={() => setSelectedRoute(route.id)}
                  className={cn(
                    "flex cursor-pointer items-start justify-between gap-4 p-4.5 transition-colors sm:px-6",
                    isSelected ? "bg-surface-muted/80" : "hover:bg-surface-muted/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold",
                        route.healthy
                          ? "border border-brand/30 bg-brand-subtle text-brand"
                          : "border border-destructive/30 bg-danger-subtle text-destructive"
                      )}
                    >
                      {route.method}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {route.path}
                        </span>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.2 font-mono text-[10px] font-medium",
                            route.zone === "Safe Band"
                              ? "border-brand/40 bg-brand-subtle text-brand"
                              : route.zone === "Saturation Knee"
                              ? "border-warning/40 bg-warning-subtle text-warning"
                              : "border-destructive/40 bg-danger-subtle text-destructive"
                          )}
                        >
                          {route.status} • {route.zone}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{route.bottleneck}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={cn(
                        "font-mono text-sm font-bold block",
                        route.healthy ? "text-foreground" : "text-destructive"
                      )}
                    >
                      {route.latencyMs} ms
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {route.rps} RPS
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Route Deep Insight Bar */}
          <div className="border-t border-border bg-surface-muted/50 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Diagnosis:</span>
              <span>{active.notes}</span>
            </div>
            <span className="font-mono text-[11px] text-brand font-medium">
              Recorded in 500ms sliding buffer
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
