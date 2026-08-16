export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskInput = {
  blastRadiusServices: number;
  trafficVolumeRps: number;
  affectedServiceCount: number;
  dependencySensitivity: number;
  historicalIncidentCount: number;
  configDiffMagnitude: number;
  simulationRegressed: boolean;
};

export type RiskScore = {
  level: RiskLevel;
  score: number;
  factors: { name: string; contribution: number }[];
};

export function computeRiskScore(input: RiskInput): RiskScore {
  const factors = [
    { name: "blast radius", contribution: Math.min(40, input.blastRadiusServices * 8) },
    { name: "traffic volume", contribution: Math.min(20, input.trafficVolumeRps / 50) },
    { name: "affected services", contribution: Math.min(15, input.affectedServiceCount * 5) },
    { name: "dependency sensitivity", contribution: Math.min(15, input.dependencySensitivity * 15) },
    { name: "historical failures", contribution: Math.min(20, input.historicalIncidentCount * 6) },
    { name: "config diff magnitude", contribution: Math.min(15, input.configDiffMagnitude * 5) },
    { name: "simulation result", contribution: input.simulationRegressed ? 25 : 0 },
  ];
  const score = Math.min(100, factors.reduce((s, f) => s + f.contribution, 0));
  const level: RiskLevel = score >= 60 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  return { level, score: Math.round(score), factors };
}

export type TopologyEdge = { from: string; to: string };

export function blastRadius(changedNode: string, edges: TopologyEdge[]): string[] {
  const dependents = new Set<string>([changedNode]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of edges) {
      if (dependents.has(e.to) && !dependents.has(e.from)) {
        dependents.add(e.from);
        grew = true;
      }
    }
  }
  return [...dependents];
}

export function dependsOn(node: string, edges: TopologyEdge[]): string[] {
  return edges.filter((e) => e.from === node).map((e) => e.to);
}

export function whatBreaksIfUnavailable(node: string, edges: TopologyEdge[]): string[] {
  return blastRadius(node, edges).filter((n) => n !== node);
}

/** Stable bucket 0–99 for SDK percentage rollout. */
export function rolloutBucket(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

export function inRollout(key: string, percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  return rolloutBucket(key) < percent;
}
