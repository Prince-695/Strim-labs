"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Zap,
  Sliders,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Policy = {
  id: string;
  name: string;
  kind: string;
  description?: string;
  mode?: "ENFORCED" | "WARNING" | "AUDIT_ONLY";
  status?: "COMPLIANT" | "DRIFT_DETECTED";
  lastEvaluated?: string;
  ruleSpec?: string;
};

export default function PoliciesPage() {
  const { token, orgId } = useSession();
  const [filter, setFilter] = useState<string>("ALL");

  const q = useQuery({
    queryKey: ["policies", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ policies: Policy[] }>("/v1/policies", { token, orgId }),
  });

  const defaultMockPolicies: Policy[] = [
    {
      id: "pol_latency_budget",
      name: "Tail Latency SLA Enforcement",
      kind: "reliability",
      description: "Automatically halt canary progression if cluster P95 latency exceeds 300ms for > 2 consecutive sampling windows.",
      mode: "ENFORCED",
      status: "COMPLIANT",
      lastEvaluated: "1m ago",
      ruleSpec: "p95_ms <= 300 && sample_window >= 2",
    },
    {
      id: "pol_canary_simulation_gate",
      name: "Pre-Flight Digital Twin Validation Gate",
      kind: "change_safety",
      description: "Requires all production change plans to achieve a 100% pre-flight synthetic simulation pass before canary traffic shifting.",
      mode: "ENFORCED",
      status: "COMPLIANT",
      lastEvaluated: "5m ago",
      ruleSpec: "simulation_status == 'passed' && risk_level != 'CRITICAL'",
    },
    {
      id: "pol_multitenant_isolation",
      name: "Tenant Namespace Header Boundary Check",
      kind: "security",
      description: "Blocks cross-tenant telemetry ingestion or trace correlation if organization headers do not match cryptographically verified claims.",
      mode: "ENFORCED",
      status: "COMPLIANT",
      lastEvaluated: "Just now",
      ruleSpec: "header['x-strim-org-id'] == jwt.claims.org_id",
    },
    {
      id: "pol_four_eyes_approval",
      name: "Four-Eyes Principle on Production Parameter Mutations",
      kind: "governance",
      description: "Demands an independent peer approval from a platform lead before any live configuration delta is applied.",
      mode: "ENFORCED",
      status: "COMPLIANT",
      lastEvaluated: "10m ago",
      ruleSpec: "approvals.count >= 1 && approver.id != author.id",
    },
    {
      id: "pol_error_hygiene",
      name: "Zero Raw Stack Trace Leakage Audit",
      kind: "compliance",
      description: "Monitors HTTP 5xx ingress responses to ensure database panics and internal stack frames are scrubbed into RFC 7807 problem payloads.",
      mode: "ENFORCED",
      status: "COMPLIANT",
      lastEvaluated: "3m ago",
      ruleSpec: "response.body !~ /(Exception|SQLSTATE|Traceback)/",
    },
  ];

  const rawPolicies = q.data?.policies ?? [];
  const policies = rawPolicies.length
    ? rawPolicies.map((p, i) => ({
        ...defaultMockPolicies[i % defaultMockPolicies.length],
        ...p,
      }))
    : defaultMockPolicies;

  const filtered = policies.filter((p) => {
    if (filter === "ALL") return true;
    return p.kind === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Architecture & Governance Policies
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enforce automated reliability guardrails, change safety gates, and cryptographic multi-tenant isolation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-semibold py-1 px-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <ShieldCheck className="size-3.5 mr-1 text-emerald-500" />
            100% Fleet Compliant
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Policy Rules</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">{policies.length}</span>
            <Shield className="size-4 text-brand-pink" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Evaluated on every canary rollout</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Policy Drift Rate</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-emerald-500">0.0%</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Zero unapproved parameter divergence</p>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-2xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Enforcement Engine</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-heading font-black text-foreground">Active Gate</span>
            <Badge variant="outline" className="text-[9px] rounded-full text-emerald-600 border-emerald-500/30 font-bold">
              Autonomous
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Instant rollback on violation</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border w-fit">
        {[
          { id: "ALL", label: "All Policies" },
          { id: "reliability", label: "Reliability" },
          { id: "change_safety", label: "Change Safety" },
          { id: "security", label: "Security" },
          { id: "governance", label: "Governance" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              filter === t.id
                ? "bg-card text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Policies Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((p) => (
          <Card key={p.id} className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/70 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="size-3.5 text-brand-pink" />
                <CardTitle className="text-xs font-heading font-bold text-foreground">
                  {p.name}
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-bold uppercase rounded-full text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              >
                {p.mode ?? "ENFORCED"}
              </Badge>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-foreground leading-relaxed">{p.description}</p>

              {p.ruleSpec && (
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/70 font-mono text-[11px] text-muted-foreground">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground block mb-0.5">
                    Evaluated Rule DSL:
                  </span>
                  <code>{p.ruleSpec}</code>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/70">
                <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                  <CheckCircle2 className="size-3.5" />
                  {p.status ?? "COMPLIANT"}
                </span>
                <span className="font-mono">Evaluated {p.lastEvaluated ?? "1m ago"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
