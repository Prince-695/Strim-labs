export type RequestRecordSummary = {
  id: string;
  requestId: string;
  traceId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  service: string | null;
  region?: string | null;
  createdAt: Date | string;
};

export type TraceSpanSummary = {
  id: string;
  service: string | null;
  path: string;
  method: string;
  status: number;
  durationMs: number;
  offsetMs: number;
  createdAt: Date | string;
};

export type TraceWaterfallResult = {
  root: unknown;
  totalDurationMs: number;
  spans: TraceSpanSummary[];
};
