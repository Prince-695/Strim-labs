const BANNED_CAUSAL = [
  /\bcaused\b/i,
  /\bcause of\b/i,
  /\broot cause is\b/i,
  /\bdefinitely\b/i,
  /\bproves that\b/i,
];

export function lintCausality(text: string): { ok: boolean; matches: string[] } {
  const matches = BANNED_CAUSAL.filter((r) => r.test(text)).map((r) => r.source);
  return { ok: matches.length === 0, matches };
}

export function hedge(text: string): string {
  if (lintCausality(text).ok) return text;
  return text
    .replace(/\bcaused\b/gi, "is a potential contributing factor to")
    .replace(/\bcause of\b/gi, "potential contributing factor for")
    .replace(/\broot cause is\b/gi, "leading correlated factor is")
    .replace(/\bdefinitely\b/gi, "possibly")
    .replace(/\bproves that\b/gi, "is consistent with");
}

export type Confidence = "Low" | "Medium" | "High";

export type CorrelatedFactor = {
  label: string;
  confidence: Confidence;
  occurredAt: string;
  sourceId: string;
};

export type NlQueryIntent =
  | { type: "slower_after_config" }
  | { type: "changed_before_incident" }
  | { type: "cache_candidates" }
  | { type: "traffic_whatif"; multiplier: number }
  | { type: "last_rollbacks"; limit: number }
  | { type: "highest_dependency_latency" }
  | { type: "unknown"; question: string };

export function parseNlQuery(question: string): NlQueryIntent {
  const q = question.toLowerCase();
  if (q.includes("slower") && q.includes("config")) return { type: "slower_after_config" };
  if (q.includes("changed before") || (q.includes("changed") && q.includes("incident"))) {
    return { type: "changed_before_incident" };
  }
  if (q.includes("cache candidate") || q.includes("good cache")) return { type: "cache_candidates" };
  const traffic = q.match(/traffic.*(\d+)\s*x/) || q.match(/(\d+)\s*x/);
  if (q.includes("traffic") && traffic) {
    return { type: "traffic_whatif", multiplier: Number(traffic[1]) };
  }
  if (q.includes("rollback")) {
    const n = q.match(/last (\d+)/);
    return { type: "last_rollbacks", limit: n ? Number(n[1]) : 3 };
  }
  if (q.includes("dependency latency") || q.includes("highest dependency")) {
    return { type: "highest_dependency_latency" };
  }
  return { type: "unknown", question };
}
