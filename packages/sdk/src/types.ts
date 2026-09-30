import type { RedactionRule, TelemetryEnvelope, TelemetryEvent } from "@strim/shared";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ConfigOptions = {
  bucketKey?: string;
};

export type StrimInitOptions = {
  projectId: string;
  environment: string;
  apiKey: string;
  ingestUrl?: string;
  configUrl?: string;
  sampleRate?: number;
  errorSampleRate?: number;
  maxBuffer?: number;
  flushIntervalMs?: number;
  configCachePath?: string;
  defaults?: Record<string, unknown>;
  enableStreaming?: boolean;
  customRedactionRules?: RedactionRule[];
  fetchImpl?: FetchLike;
  onError?: (err: Error) => void;
};

export type SdkBufferStats = {
  buffered: number;
  capacity: number;
  dropped: number;
  totalCaptured: number;
  totalFlushed: number;
};

export type { RedactionRule, TelemetryEnvelope, TelemetryEvent };
