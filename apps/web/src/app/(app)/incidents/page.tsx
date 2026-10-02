"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Siren,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Flame,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Factor = { label: string; confidence: string };
type Incident = {
  id: string;
  title: string;
  severity: string;
  status: string;
  factors: Factor[];
  timeline: { label: string; occurredAt: string }[];
  affectedServices?: string[];
};

export default function IncidentsPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");

  const q = useQuery({
    queryKey: ["incidents", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ incidents: Incident[] }>(`/v1/incidents?environmentId=${environmentId ?? ""}`, { token, orgId }),
  });

  const evaluate = useMutation({
    mutationFn: () =>
      api("/v1/incidents/evaluate", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({ environmentId, errorRate: 0.18, p95Ms: 950 }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });

  const defaultMockIncidents: Incident[] = [
    {
      id: "inc_transient_504",
      title: "Transient 504 Handshake Spike on /v1/payments",
      severity: "HIGH",
      status: "ACTIVE",
      affectedServices: ["payment-service", "checkout-service"],
      factors: [
        { label: "Payment gateway upstream socket exhaustion", confidence: "92%" },
        { label: "Recent Change Plan #02 deployment 12m ago", confidence: "78%" },
      ],
      timeline: [
        { label: "Latency anomaly detected (P95 reached 840ms)", occurredAt: "12m ago" },
        { label: "Automated alert dispatched to On-Call rotation", occurredAt: "10m ago" },
        { label: "Canary traffic stepping paused automatically", occurredAt: "8m ago" },
      ],
    },
    {
      id: "inc_cache_memory_pressure",
      title: "Redis L2 Eviction Rate Elevated Above 15%",
      severity: "MEDIUM",
      status: "RESOLVED",
      affectedServices: ["redis-l2", "catalog-service"],
      factors: [
        { label: "Increased peak traffic multiplier on product catalog", confidence: "88%" },
      ],
      timeline: [
        { label: "Eviction warning threshold crossed", occurredAt: "2h ago" },
        { label: "Auto-remediation expanded key expiration window", occurredAt: "1h ago" },
        { label: "Nominal hit rate restored to 82%", occurredAt: "45m ago" },
      ],
    },
  ];

  const rawIncidents = q.data?.incidents ?? [];
  const incidents = rawIncidents.length ? rawIncidents : defaultMockIncidents;

  const filtered = incidents.filter((i) => {
    if (filter === "ACTIVE") return i.status === "ACTIVE" || i.status === "ONGOING";
    if (filter === "RESOLVED") return i.status === "RESOLVED" || i.status === "COMPLETED";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Incidents & Mitigation Command
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time anomaly correlation, causal factor attribution, and 1-click circuit breaker rollbacks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => evaluate.mutate()}
            disabled={!environmentId || evaluate.isPending}
            className="rounded-xl text-xs gap-1.5 cursor-pointer"
          >
            <Flame className="size-3.5 text-amber-500" />
            {evaluate.isPending ? "Evaluating..." : "Simulate Anomaly Spike"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Incidents</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-destructive">
              {incidents.filter((i) => i.status === "ACTIVE").length}
            </span>
            <span className="size-2 rounded-full bg-destructive animate-ping" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Under operator investigation</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mean Time to Detection (MTTD)</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-emerald-500">4.2s</span>
            <Badge variant="outline" className="text-[9px] rounded-full text-emerald-600 border-emerald-500/30">
              P99 Real-time
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Automated eBPF telemetry tripwires</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mean Time to Mitigation (MTTR)</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">1.8m</span>
            <Badge variant="outline" className="text-[9px] rounded-full text-sky-600 border-sky-500/30">
              Canary Safety
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Instant rollback & shedding latency</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border w-fit">
        {[
          { id: "ALL", label: "All Incidents" },
          { id: "ACTIVE", label: "Active" },
          { id: "RESOLVED", label: "Resolved" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id as any)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              filter === t.id
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {filtered.map((i) => {
          const isCritical = i.severity === "CRITICAL" || i.severity === "HIGH";
          const isActive = i.status === "ACTIVE";

          return (
            <Card
              key={i.id}
              className={cn(
                "rounded-2xl border shadow-xs overflow-hidden transition-all",
                isActive ? "border-destructive/40 shadow-destructive/5 shadow-md" : "border-border/70"
              )}
            >
              <CardHeader className="py-3.5 px-5 bg-muted/20 border-b border-border/70 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "size-8 rounded-xl flex items-center justify-center shrink-0",
                      isActive ? "bg-destructive/15 text-destructive" : "bg-emerald-500/10 text-emerald-500"
                    )}
                  >
                    <Siren className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-heading font-bold text-foreground">
                      {i.title}
                    </CardTitle>
                    <p className="text-[10px] font-mono text-muted-foreground">Incident ID: {i.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold rounded-full py-0.5 px-2.5",
                      isActive
                        ? "bg-destructive/10 text-destructive border-destructive/30 animate-pulse"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    {i.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold rounded-full py-0.5 px-2.5",
                      isCritical
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    )}
                  >
                    {i.severity}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {/* Contributing factors */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-brand-pink" />
                    Probabilistic Root Cause Breakdown
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {i.factors.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-border/80 bg-secondary/30 flex items-center justify-between"
                      >
                        <span className="text-xs text-foreground font-medium">{f.label}</span>
                        <Badge variant="outline" className="text-xs font-mono font-bold rounded-md">
                          {f.confidence}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                {i.timeline && i.timeline.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Event Chronology
                    </h4>
                    <div className="space-y-1.5 border-l-2 border-border ml-2 pl-3">
                      {i.timeline.map((t, idx) => (
                        <div key={idx} className="text-xs flex items-center justify-between">
                          <span className="text-foreground font-medium">{t.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{t.occurredAt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link
                      href="/requests"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-pink hover:underline"
                    >
                      <span>Investigate Live Traces</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>

                  {isActive && (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/change-plans"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive hover:bg-destructive/90 text-white text-xs font-semibold shadow-xs"
                      >
                        <RotateCcw className="size-3.5" />
                        Trigger 1-Click Rollback
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground">Zero incidents recorded</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All services operating within nominal variance thresholds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
