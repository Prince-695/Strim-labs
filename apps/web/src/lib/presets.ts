import { API_URL } from "./api";
import type { TestProfile } from "./types";

export type Preset = {
  id: "smoke" | "ramp" | "spike" | "breaking";
  name: string;
  concurrency: number;
  durationSec: number;
  profile: TestProfile;
  curveLabel: string;
  tone: "emerald" | "cyan" | "amber" | "rose";
  blurb: string;
};

/** The four canonical presets. Starting points, not safety guarantees — the server enforces its own limits. */
export const PRESETS: Preset[] = [
  {
    id: "smoke",
    name: "Smoke Probe",
    concurrency: 10,
    durationSec: 10,
    profile: "SUSTAINED",
    curveLabel: "Sustained",
    tone: "emerald",
    blurb: "Sanity check for auth, token validation and connection pools.",
  },
  {
    id: "ramp",
    name: "Capacity Ramp",
    concurrency: 50,
    durationSec: 30,
    profile: "RAMP_UP",
    curveLabel: "Ramp-up",
    tone: "cyan",
    blurb: "Linear concurrency increase to locate the saturation knee.",
  },
  {
    id: "spike",
    name: "Spike Surge",
    concurrency: 150,
    durationSec: 15,
    profile: "SPIKE",
    curveLabel: "Instant burst",
    tone: "amber",
    blurb: "Sudden burst to see how workers and queues absorb it.",
  },
  {
    id: "breaking",
    name: "Breaking Point Hunt",
    concurrency: 300,
    durationSec: 45,
    profile: "RAMP_UP",
    curveLabel: "Aggressive ramp",
    tone: "rose",
    blurb: "Push to saturation to find the ceiling and the failure mode.",
  },
];

export const DEMO_TARGET = {
  name: "STRIM Demo API",
  targetUrl: `${API_URL}/health`,
  defaultMethod: "GET" as const,
};

export const DEMO_PERSONA = {
  label: "Priya (Acme Corp owner)",
  email: "priya@acme.test",
  password: "password123",
};
