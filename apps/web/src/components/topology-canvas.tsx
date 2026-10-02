"use client";

import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";

export default function TopologyCanvas({
  nodes,
  edges,
  onNodeClick,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
}) {
  return (
    <div className="h-full w-full bg-card/60 backdrop-blur-xs relative overflow-hidden rounded-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
        className="text-foreground"
      >
        <MiniMap
          nodeStrokeColor="#EA4C89"
          nodeColor="#1e293b"
          maskColor="rgba(0, 0, 0, 0.6)"
          className="bg-card border border-border rounded-xl overflow-hidden shadow-lg"
        />
        <Controls className="bg-card border border-border text-foreground rounded-xl shadow-md p-1" />
        <Background color="currentColor" className="text-border/40" gap={24} size={1} />
      </ReactFlow>
    </div>
  );
}
