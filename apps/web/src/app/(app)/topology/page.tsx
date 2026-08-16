"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

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
  const nodes = useMemo(
    () =>
      (q.data?.nodes ?? []).map((n, i) => ({
        id: n.name,
        position: { x: 80 + (i % 3) * 220, y: 60 + Math.floor(i / 3) * 140 },
        data: { label: n.name },
      })),
    [q.data],
  );
  const edges = useMemo(
    () =>
      (q.data?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.fromName,
        target: e.toName,
      })),
    [q.data],
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Topology</h1>
      <div className="h-[520px] overflow-hidden rounded-xl border bg-card">
        <Canvas nodes={nodes} edges={edges} />
      </div>
      {(q.data?.nodes.length ?? 0) === 0 ? (
        <p className="text-muted-foreground">No graph yet. Ingest traffic from demo-checkout to auto-derive edges.</p>
      ) : null}
    </div>
  );
}
