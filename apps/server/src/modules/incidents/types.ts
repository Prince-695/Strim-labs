export type EvaluateIncidentInput = {
  environmentId: string;
  errorRate: number;
  p95Ms: number;
};

export type IncidentConfidence = "High" | "Medium" | "Low";

export type IncidentFactorRecord = {
  id: string;
  label: string;
  confidence: IncidentConfidence;
  sourceId: string;
  occurredAt: Date;
};

export type IncidentTimelineRecord = {
  id: string;
  label: string;
  occurredAt: Date;
};

export type IncidentRecord = {
  id: string;
  organizationId: string;
  environmentId: string;
  title: string;
  severity: string;
  status: string;
  changePlanId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  factors?: IncidentFactorRecord[];
  timeline?: IncidentTimelineRecord[];
};
