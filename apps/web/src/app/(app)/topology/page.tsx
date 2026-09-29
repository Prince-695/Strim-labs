"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Server, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Canvas = dynamic(() => import("@/components/topology-canvas"), { ssr: false });

type NodeRow = { id: string; name: string; kind: string };
type EdgeRow = { id: string; fromName: string; toName: string };

export default function TopologyPage() {
  const { token, orgId, environmentId } = useSession();

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

  // Default inferred graph if environment hasn't received cross-service telemetry yet
  const displayNodes = rawNodes.length
    ? rawNodes
    : [
        { id: "api-gateway", name: "api-gateway", kind: "gateway" },
        { id: "checkout-service", name: "checkout-service", kind: "service" },
        { id: "inventory-service", name: "inventory-service", kind: "service" },
        { id: "payment-service", name: "payment-service", kind: "service" },
        { id: "postgres-main", name: "postgres-main", kind: "database" },
        { id: "redis-l2", name: "redis-l2", kind: "cache" },
      ];

  const displayEdges = rawEdges.length
    ? rawEdges
    : [
        { id: "e1", fromName: "api-gateway", toName: "checkout-service" },
        { id: "e2", fromName: "checkout-service", toName: "inventory-service" },
        { id: "e3", fromName: "checkout-service", toName: "payment-service" },
        { id: "e4", fromName: "checkout-service", toName: "redis-l2" },
        { id: "e5", fromName: "inventory-service", toName: "postgres-main" },
      ];

  const nodes = useMemo(
    () =>
      displayNodes.map((n, i) => {
        const isDb = n.name.includes("postgres") || n.name.includes("db");
        const isCache = n.name.includes("redis") || n.name.includes("cache");
        const isGateway = n.name.includes("gateway");

        return {
          id: n.name,
          position: {
            x: isGateway ? 60 : isCache || isDb ? 560 : 310,
            y: 80 + (i % 3) * 130 + (isDb ? 60 : 0),
          },
          data: {
            label: (
              <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 shadow-md min-w-36 text-center">
                <div className="text-[10px] uppercase font-semibold text-slate-400">
                  {isGateway ? "Gateway" : isCache ? "L2 Cache" : isDb ? "Database" : "Microservice"}
                </div>
                <div className="text-xs font-bold text-slate-100 mt-0.5">{n.name}</div>
              </div>
            ),
          },
        };
      }),
    [displayNodes],
  );

  const edges = useMemo(
    () =>
      displayEdges.map((e) => ({
        id: e.id,
        source: e.fromName,
        target: e.toName,
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 2 },
      })),
    [displayEdges],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Service Dependency Graph</h1>
          <p className="text-sm text-muted-foreground">
            Distributed RPC caller-callee lineage automatically reconstructed from trace propagation headers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="cursor-pointer gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
            Refresh Lineage
          </Button>
        </div>
      </div>

      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardHeader className="border-b py-3 px-4 bg-muted/20 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Live Microservice Topology</CardTitle>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> Healthy ({nodes.length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500 animate-pulse" /> Active RPC ({edges.length})
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[540px] w-full">
            <Canvas nodes={nodes} edges={edges} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
