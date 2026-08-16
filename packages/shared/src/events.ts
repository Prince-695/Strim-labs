export const EVENT_TYPES = [
  "REQUEST_STARTED",
  "REQUEST_COMPLETED",
  "ERROR_DETECTED",
  "CONFIG_CHANGED",
  "CACHE_UPDATED",
  "CACHE_INVALIDATED",
  "SIMULATION_STARTED",
  "SIMULATION_PROGRESS",
  "SIMULATION_COMPLETED",
  "LOAD_TEST_STARTED",
  "LOAD_TEST_PROGRESS",
  "LOAD_TEST_COMPLETED",
  "CHANGE_APPROVED",
  "ROLLOUT_STARTED",
  "ROLLOUT_PAUSED",
  "ROLLBACK_STARTED",
  "ROLLBACK_COMPLETED",
  "INCIDENT_CREATED",
  "INCIDENT_RESOLVED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type StrimEvent = {
  type: EventType;
  organizationId: string;
  environmentId?: string;
  resourceId?: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};
