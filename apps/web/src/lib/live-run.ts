"use client";

import { useSyncExternalStore } from "react";

/**
 * Tracks the run that is actually executing right now (set by the runner cockpit),
 * so the sidebar's live indicator is backed by real run state and never decorative.
 */
type Live = { runId: string | null };
let state: Live = { runId: null };
const listeners = new Set<() => void>();

export function setLiveRun(runId: string | null) {
  if (state.runId === runId) return;
  state = { runId };
  listeners.forEach((l) => l());
}

export function useLiveRunId(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state.runId,
    () => null,
  );
}
