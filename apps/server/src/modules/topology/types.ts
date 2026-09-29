import type { TopologyEdge as SharedTopologyEdge } from "@strim/shared";

export type { SharedTopologyEdge };

export type TopologyQueryType = "depends" | "breaks" | "blast";

export type AnnotateTopologyInput = {
  environmentId: string;
  fromName: string;
  toName: string;
};
