import type { TestStatus } from "./types";

/**
 * Single source of truth for how the backend reports `errorRate`.
 * The gate blueprint treats it as a 0–1 fraction. Flip this if the API ever returns percent.
 */
export const ERROR_RATE_IS_FRACTION = true;

export const MISSING = "—";

export function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function fmtInt(v: number | null | undefined): string {
  return isNum(v) ? Math.round(v).toLocaleString("en-US") : MISSING;
}

export function fmtRps(v: number | null | undefined): string {
  return isNum(v) ? `${Math.round(v).toLocaleString("en-US")}` : MISSING;
}

export function fmtMs(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v >= 100 ? Math.round(v) : v.toFixed(1)} ms`;
}

/** Error rate → percentage string. Missing values stay "—", never 0. */
export function fmtErrorRate(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  const pct = ERROR_RATE_IS_FRACTION ? v * 100 : v;
  return `${pct.toFixed(pct > 0 && pct < 0.01 ? 3 : 2)}%`;
}

export function errorRateToPct(v: number): number {
  return ERROR_RATE_IS_FRACTION ? v * 100 : v;
}

export function fmtSignedPct(v: number | null | undefined, digits = 1): string {
  if (!isNum(v)) return MISSING;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return MISSING;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return MISSING;
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return MISSING;
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function profileLabel(p: string): string {
  switch (p) {
    case "SUSTAINED":
      return "Sustained";
    case "RAMP_UP":
      return "Ramp-up";
    case "SPIKE":
      return "Spike";
    default:
      return p;
  }
}

export function isAbortedStatus(s: TestStatus | string | undefined): boolean {
  return s === "ABORTED" || s === "CANCELLED";
}

export function isTerminalStatus(s: TestStatus | string | undefined): boolean {
  return s === "COMPLETED" || s === "FAILED" || isAbortedStatus(s);
}

export function statusLabel(s: TestStatus | string): string {
  switch (s) {
    case "QUEUED":
      return "Queued";
    case "RUNNING":
      return "Running";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "ABORTED":
    case "CANCELLED":
      return "Aborted";
    default:
      return s;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function groupStatusCodes(codes: Record<string, number> | undefined) {
  const out = { c2xx: 0, c3xx: 0, c4xx: 0, c429: 0, c5xx: 0, other: 0 };
  if (!codes) return out;
  for (const [code, n] of Object.entries(codes)) {
    const c = Number(code);
    if (!Number.isFinite(c)) out.other += n;
    else if (c === 429) out.c429 += n;
    else if (c >= 200 && c < 300) out.c2xx += n;
    else if (c >= 300 && c < 400) out.c3xx += n;
    else if (c >= 400 && c < 500) out.c4xx += n;
    else if (c >= 500) out.c5xx += n;
    else out.other += n;
  }
  return out;
}
