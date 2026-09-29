import type { RuntimeDiffEntry } from "@strim/shared";

export type { RuntimeDiffEntry };

export type UpsertConfigurationInput = {
  environmentId: string;
  key: string;
  value: unknown;
  reason: string;
};

export type RuntimeDiffResult = {
  diffs: RuntimeDiffEntry[];
  lines: string[];
};

export type SdkConfigResult = {
  values: Record<string, unknown>;
  proposed: Record<string, unknown>;
  rolloutPercent: number;
};
