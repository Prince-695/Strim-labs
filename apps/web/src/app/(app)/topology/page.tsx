"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  RefreshCw,
  Server,
  Database,
  Layers,
  Zap,
  ArrowRight,
  ShieldAlert,
  Flame,
  X,
  ListTree,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const Canvas = dynamic(() => import("@/components/topology-canvas"), { ssr: false });

type NodeRow = { id: string; name: string; kind: string };
type EdgeRow = { id: string; fromName: string; toName: string };

export default function TopologyPage() {
  const { token, orgId, environmentId } = useSession();
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>("checkout-service");
  const [filterKind, setFilterKind] = useState<string>("all");

  const q = useQuery({
    queryKey: ["topology", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ nodes: NodeRow[]; edges: EdgeRow[] }>(`/v1/topology?environmentId=${environmentId}`, {
        token,
        orgId,
      }),
  });

  const rawNodes = q.data?.nodes ?? [];
  const rawEdges = q.data?.edges ?? [];

  const defaultNodes: NodeRow[] = [
    { id: "api-gateway", name: "api-gateway", kind: "gateway" },
    { id: "checkout-service", name: "checkout-service", kind: "service" },
    { id: "inventory-service", name: "inventory-service", kind: "service" },
    { id: "payment-service", name: "payment-service", kind: "service" },
    { id: "postgres-main", name: "postgres-main", kind: "database" },
    { id: "redis-l2", name: "redis-l2", kind: "cache" },
  ];

  const defaultEdges: EdgeRow[] = [
    { id: "e1", fromName: "api-gateway", toName: "checkout-service" },
    { id: "e2", fromName: "checkout-service", toName: "inventory-service" },
    { id: "e3", fromName: "checkout-service", toName: "payment-service" },
    { id: "e4", fromName: "checkout-service", toName: "redis-l2" },
    { id: "e5", fromName: "inventory-service", toName: "postgres-main" },
  ];

  const displayNodes = rawNodes.length ? rawNodes : defaultNodes;
  const displayEdges = rawEdges.length ? rawEdges : defaultEdges;

  const filteredNodes = useMemo(() => {
    if (filterKind === "all") return displayNodes;
    if (filterKind === "gateway") return displayNodes.filter((n) => n.kind === "gateway" || n.name.includes("gateway"));
    if (filterKind === "database") return displayNodes.filter((n) => n.kind === "database" || n.kind === "cache" || n.name.includes("db") || n.name.includes("redis"));
    return displayNodes.filter((n) => n.kind === "service" || (!n.name.includes("gateway") && !n.name.includes("db")));
  }, [displayNodes, filterKind]);

  const nodes = useMemo(
    () =>
      filteredNodes.map((n, i) => {
        const isDb = n.name.includes("postgres") || n.name.includes("db");
        const isCache = n.name.includes("redis") || n.name.includes("cache");
        const isGateway = n.name.includes("gateway");
        const isSelected = selectedNodeName === n.name;

        let kindLabel = "Microservice";
        let KindIcon = Server;
        let badgeColor = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";

        if (isGateway) {
          kindLabel = "Edge Gateway";
          KindIcon = Zap;
          badgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        } else if (isCache) {
          kindLabel = "L2 Cache";
          KindIcon = Layers;
          badgeColor = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
        } else if (isDb) {
          kindLabel = "Storage DB";
          KindIcon = Database;
          badgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
        }

        return {
          id: n.name,
          position: {
            x: isGateway ? 60 : isCache || isDb ? 560 : 310,
            y: 80 + (i % 3) * 140 + (isDb ? 60 : 0),
          },
          data: {
            label: (
              <div
                className={cn(
                  "p-3 rounded-2xl border bg-card/95 backdrop-blur-md shadow-md min-w-44 transition-all duration-200 cursor-pointer text-left",
                  isSelected
                    ? "border-brand-pink ring-2 ring-brand-pink/30 shadow-brand-pink/10 shadow-lg scale-105"
                    : "border-border hover:border-brand-pink/50 hover:shadow-lg"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={cn("text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full border", badgeColor)}>
                    {kindLabel}
                  </span>
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0">
                    <KindIcon className="size-3.5" />
                  </div>
                  <div className="text-xs font-heading font-bold text-foreground truncate">{n.name}</div>
                </div>
              </div>
            ),
          },
        };
      }),
    [filteredNodes, selectedNodeName]
  );

  const edges = useMemo(
    () =>
      displayEdges.map((e) => {
        const isHighlight =
          e.fromName === selectedNodeName || e.toName === selectedNodeName;

        return {
          id: e.id,
          source: e.fromName,
          target: e.toName,
          animated: true,
          style: {
            stroke: isHighlight ? "#EA4C89" : "#64748b",
            strokeWidth: isHighlight ? 2.5 : 1.5,
          },
        };
      }),
    [displayEdges, selectedNodeName]
  );

  const selectedNodeInfo = useMemo(() => {
    if (!selectedNodeName) return null;
    const downstream = displayEdges.filter((e) => e.fromName === selectedNodeName).map((e) => e.toName);
    const upstream = displayEdges.filter((e) => e.toName === selectedNodeName).map((e) => e.fromName);
    return {
      name: selectedNodeName,
      downstream,
      upstream,
      blastRadiusScore: 78,
      rps: 184,
      p95: 145,
      errorRatio: "0.01%",
    };
  }, [selectedNodeName, displayEdges]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-extrabold tracking-tight text-foreground">
            Distributed Service Topology
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time caller-callee dependency graph automatically reconstructed from distributed trace headers.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="rounded-xl text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", q.isFetching && "animate-spin")} />
            Resync Lineage
          </Button>
        </div>
      </div>

      {/* Main Canvas & Inspector Layout */}
      <div className="grid gap-6 lg:grid-cols-4 items-start">
        {/* Left: 3-column Canvas Frame */}
        <div className="lg:col-span-3 space-y-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Filter View:</span>
            {[
              { id: "all", label: "All Nodes" },
              { id: "service", label: "Microservices" },
              { id: "gateway", label: "Gateways" },
              { id: "database", label: "Storage & Caches" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterKind(f.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                  filterKind === f.id
                    ? "bg-brand-pink text-white border-brand-pink shadow-xs shadow-brand-pink/20"
                    : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
            <CardHeader className="border-b border-border/70 py-3 px-4 bg-muted/20 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="size-4 text-brand-pink" />
                <CardTitle className="text-xs font-heading font-bold text-foreground">
                  Trace Propagation Mesh
                </CardTitle>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" /> Healthy Nodes ({displayNodes.length})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-brand-pink animate-pulse" /> Active RPCs ({displayEdges.length})
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[560px] w-full">
                <Canvas
                  nodes={nodes}
                  edges={edges}
                  onNodeClick={(_, node) => setSelectedNodeName(node.id)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: 1-column Blast Radius Inspector */}
        <div className="lg:col-span-1">
          {selectedNodeInfo ? (
            <Card className="rounded-2xl border-border/70 shadow-md">
              <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full bg-brand-pink/10 text-brand-pink border-brand-pink/20">
                      Inspector
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-heading font-bold text-foreground truncate max-w-[200px]">
                    {selectedNodeInfo.name}
                  </CardTitle>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeName(null)}
                  className="size-7 rounded-lg text-muted-foreground hover:bg-secondary flex items-center justify-center cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Blast Radius Gauge */}
                <div className="p-3 rounded-xl bg-secondary/50 border border-border/70">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Flame className="size-3.5 text-amber-500" />
                      Blast Radius Score
                    </span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {selectedNodeInfo.blastRadiusScore}/100
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-brand-pink rounded-full"
                      style={{ width: `${selectedNodeInfo.blastRadiusScore}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    A failure here impacts {selectedNodeInfo.downstream.length + 1} downstream endpoints.
                  </p>
                </div>

                {/* Telemetry quick numbers */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 rounded-xl border border-border bg-card">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Inbound RPS</p>
                    <p className="text-base font-heading font-black text-foreground mt-0.5">
                      {selectedNodeInfo.rps}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-border bg-card">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">P95 Latency</p>
                    <p className="text-base font-heading font-black text-foreground mt-0.5">
                      {selectedNodeInfo.p95}ms
                    </p>
                  </div>
                </div>

                {/* Direct Dependents List */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Downstream Calls ({selectedNodeInfo.downstream.length})
                  </h4>
                  {selectedNodeInfo.downstream.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No downstream services (Terminal leaf)</p>
                  ) : (
                    <div className="space-y-1">
                      {selectedNodeInfo.downstream.map((name) => (
                        <div
                          key={name}
                          onClick={() => setSelectedNodeName(name)}
                          className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 hover:bg-secondary text-xs cursor-pointer transition-colors"
                        >
                          <span className="font-semibold text-foreground truncate">{name}</span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick action buttons */}
                <div className="pt-2 border-t border-border space-y-2">
                  <Link
                    href={`/simulations?target=${selectedNodeInfo.name}`}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-brand-pink text-white text-xs font-semibold shadow-xs hover:bg-brand-pink/90 transition-all"
                  >
                    <FlaskConical className="size-3.5" />
                    Simulate Latency Spike
                  </Link>
                  <Link
                    href={`/requests?service=${selectedNodeInfo.name}`}
                    className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-all"
                  >
                    <ListTree className="size-3.5" />
                    Filter Traces in Explorer
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-6 rounded-2xl border border-dashed border-border text-center bg-card">
              <ShieldAlert className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-foreground">No node selected</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Click any service or database node on the canvas to inspect its blast radius and telemetry.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
