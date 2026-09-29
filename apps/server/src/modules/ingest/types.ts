import type { RedactionRule, TelemetryEnvelope, TelemetryEvent } from "@strim/shared";

export type { RedactionRule, TelemetryEnvelope, TelemetryEvent };

export type IngestResult = {
  accepted: boolean;
  queuedEvents: number;
};
