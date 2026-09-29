"use client";

import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";

export default function TopologyCanvas({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  return (
    <div className="h-full w-full bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        className="text-foreground"
      >
        <MiniMap
          nodeStrokeColor="#3b82f6"
          nodeColor="#1e293b"
          maskColor="rgba(0, 0, 0, 0.7)"
          className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
        />
        <Controls className="bg-slate-900 border-slate-800 fill-slate-200" />
        <Background color="#334155" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
