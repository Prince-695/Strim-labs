"use client";

import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from "@xyflow/react";

export default function TopologyCanvas({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  return (
    <ReactFlow nodes={nodes} edges={edges} fitView>
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}
