export type ReplayMode = "exact" | "session" | "traffic" | "scaled" | "transformed";

export type ReplayTargetEnvType = "DEVELOPMENT" | "STAGING" | "PRODUCTION";

export type CreateReplayInput = {
  environmentId: string;
  mode: ReplayMode;
  requestIds: string[];
  targetEnvType: ReplayTargetEnvType;
  scale?: number;
  transform?: Record<string, unknown>;
};
