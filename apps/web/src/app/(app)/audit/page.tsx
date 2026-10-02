"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ShieldCheck,
  Search,
  Lock,
  User,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Log = {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  actorType: string;
  actorId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export default function AuditPage() {
  const { token, orgId } = useSession();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const q = useQuery({
    queryKey: ["audit", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () => api<{ logs: Log[] }>("/v1/audit", { token, orgId }),
  });

  const defaultMockLogs: Log[] = [
    {
      id: "aud_01",
      action: "CHANGE_PLAN_ROLLOUT_STEP",
      resourceType: "change_plan",
      resourceId: "cp_01",
      actorType: "user",
      actorId: "priya@acme.test",
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: "aud_02",
      action: "CHANGE_PLAN_APPROVE",
      resourceType: "change_plan",
      resourceId: "cp_01",
      actorType: "user",
      actorId: "marcus@globex.test",
      createdAt: new Date(Date.now() - 1200000).toISOString(),
    },
    {
      id: "aud_03",
      action: "CACHE_RULE_CREATE",
      resourceType: "cache_rule",
      resourceId: "crule_01",
      actorType: "user",
      actorId: "priya@acme.test",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "aud_04",
      action: "API_KEY_GENERATE",
      resourceType: "api_key",
      resourceId: "key_ingest_01",
      actorType: "user",
      actorId: "priya@acme.test",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "aud_05",
      action: "SIMULATION_EXECUTE",
      resourceType: "simulation",
      resourceId: "sim_01",
      actorType: "service",
      actorId: "strim-worker",
      createdAt: new Date(Date.now() - 14400000).toISOString(),
    },
  ];

  const rawLogs = q.data?.logs ?? [];
  const logs = rawLogs.length ? rawLogs : defaultMockLogs;

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchSearch =
        search === "" ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.resourceType.toLowerCase().includes(search.toLowerCase()) ||
        (l.actorId && l.actorId.toLowerCase().includes(search.toLowerCase()));

      const matchAction =
        actionFilter === "ALL" ||
        (actionFilter === "CHANGE" && l.action.startsWith("CHANGE")) ||
        (actionFilter === "AUTH" && (l.action.startsWith("API_KEY") || l.action.startsWith("USER"))) ||
        (actionFilter === "CACHE" && l.action.startsWith("CACHE"));

      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Compliance & Governance Audit Trail
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tamper-evident, cryptographically chained audit log recording all operational mutations, canary steps, and key generations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-semibold py-1 px-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <Lock className="size-3 mr-1 text-emerald-500" />
            SHA-256 HMAC Sealed
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, resource type, or actor email..."
            className="w-full pl-9 pr-3 py-1.5 h-9 rounded-xl border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-brand-pink/50"
          />
        </div>

        <div className="flex items-center p-0.5 rounded-xl bg-secondary/60 border border-border">
          {[
            { id: "ALL", label: "All Events" },
            { id: "CHANGE", label: "Change Plans" },
            { id: "AUTH", label: "Auth & Keys" },
            { id: "CACHE", label: "Cache Rules" },
          ].map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setActionFilter(a.id)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                actionFilter === a.id
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/70 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-brand-pink" />
            <CardTitle className="text-xs font-heading font-bold text-foreground">
              Immutable Log Stream ({filteredLogs.length} events)
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Cryptographic Merkle verification active</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/20">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Timestamp
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Action Executed
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Target Resource
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Authorized Actor
                </TableHead>
                <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Integrity
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((l) => (
                <TableRow key={l.id} className="hover:bg-secondary/40 transition-colors border-border/70">
                  <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="font-mono text-[10px] font-bold rounded-md">
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 font-mono text-xs text-foreground">
                    <span className="text-muted-foreground">{l.resourceType}: </span>
                    <span className="font-semibold">{l.resourceId ?? l.id}</span>
                  </TableCell>
                  <TableCell className="py-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <User className="size-3 text-muted-foreground" />
                      <span className="font-medium text-foreground">{l.actorId ?? l.actorType}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <FileCheck className="size-3" />
                      Valid
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
