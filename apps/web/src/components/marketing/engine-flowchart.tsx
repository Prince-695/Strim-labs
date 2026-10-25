"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  RotateCcw,
  Server,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FlowStep {
  id: string;
  stepNumber: string;
  title: string;
  shortDesc: string;
  category: string;
  badgeColor: string;
  icon: typeof Zap;
  details: {
    heading: string;
    description: string;
    specs: Array<{ label: string; value: string }>;
    codeOrSnippet: {
      title: string;
      language: string;
      code: string;
    };
  };
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: "sdk-ingest",
    stepNumber: "01",
    title: "SDK Ingestion & Route Discovery",
    shortDesc: "1-line middleware captures production traffic & auto-discovers routes.",
    category: "Data Ingestion",
    badgeColor: "border-brand/40 bg-brand-subtle text-success-text",
    icon: Zap,
    details: {
      heading: "Zero-Config Production Ingestion",
      description:
        "Developers attach @strim/sdk as lightweight middleware to Hono, Express, Next.js, or Fastify. Incoming requests and endpoints are automatically mapped with status codes, methods, and timing without writing OpenAPI specs.",
      specs: [
        { label: "Overhead", value: "< 0.15 ms per request" },
        { label: "Configuration", value: "Zero (automatic route discovery)" },
        { label: "Supported Runtimes", value: "Node.js, Bun, Edge Runtimes" },
      ],
      codeOrSnippet: {
        title: "server.ts",
        language: "typescript",
        code: `import { strim } from "@strim/sdk";

// Add 1-line middleware: auto-discovers all routes & timing
app.use("*", strim({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "cmvntmjxv0005...",
}));`,
      },
    },
  },
  {
    id: "ring-buffer",
    stepNumber: "02",
    title: "Microsecond Ring Buffer",
    shortDesc: "In-memory circular telemetry queue batches metrics asynchronously.",
    category: "Edge Aggregation",
    badgeColor: "border-info/40 bg-info-subtle text-info",
    icon: Cpu,
    details: {
      heading: "500 ms In-Memory Telemetry Ring Buffer",
      description:
        "Requests are registered in an ultra-fast in-memory ring buffer. Nothing makes blocking database calls on your hot path. Telemetry is flushed to the STRIM ingestion gateway in background ticks.",
      specs: [
        { label: "Sampling Window", value: "500 ms rolling slices" },
        { label: "Memory Footprint", value: "< 2 MB fixed ring buffer" },
        { label: "I/O Impact", value: "Zero blocking database roundtrips" },
      ],
      codeOrSnippet: {
        title: "telemetry-buffer.json",
        language: "json",
        code: `{
  "timestamp": "2026-10-25T19:00:00.500Z",
  "route": "/api/checkout/process",
  "samples": 482,
  "p50Ms": 28.4,
  "p95Ms": 42.1,
  "p99Ms": 89.6,
  "statusCounts": { "200": 480, "429": 2 }
}`,
      },
    },
  },
  {
    id: "observability",
    stepNumber: "03",
    title: "Rolling Telemetry & Flagging",
    shortDesc: "Continuous P50/P95 latency percentiles with Green/Orange/Red health flags.",
    category: "Live Telemetry",
    badgeColor: "border-brand/40 bg-brand-subtle text-brand",
    icon: Activity,
    details: {
      heading: "Continuous Observability & Real-Time Flags",
      description:
        "The STRIM engine computes rolling latencies and error ratios across all endpoints in real time. Anomaly detection instantly flags queue buildups or latency drift before outages cascade.",
      specs: [
        { label: "Metrics Tracked", value: "RPS, P50, P95, P99, Error Ratio" },
        { label: "Status Flags", value: "🟢 Normal · 🟠 Degrading · 🔴 Breached" },
        { label: "Stream Format", value: "Server-Sent Events (SSE) live feed" },
      ],
      codeOrSnippet: {
        title: "live-health-stream.ts",
        language: "typescript",
        code: `// Real-time automated status evaluation
if (p95Latency > baseline * 2.5 || errorRatio > 0.05) {
  emitStatusFlag("RED_FLAG", {
    reason: "P95 Tail Latency Drift (> 250% baseline)",
    affectedRoutes: ["/api/checkout/process"]
  });
}`,
      },
    },
  },
  {
    id: "saturation-engine",
    stepNumber: "04",
    title: "Automated 7-Day Saturation Ramp",
    shortDesc: "Multi-worker Bun engine scales concurrency to find breaking limits.",
    category: "Load Generator",
    badgeColor: "border-warning/40 bg-warning-subtle text-warning-text",
    icon: Server,
    details: {
      heading: "Automated Weekly & On-Demand Saturation Engine",
      description:
        "Every 7 days (or on demand), STRIM runs an automated progressive capacity test. Multi-worker native Bun runners generate realistic concurrency waves without the load generator ever bottlenecking.",
      specs: [
        { label: "Engine Runtime", value: "Bun multi-threaded workers" },
        { label: "Schedule", value: "Weekly 7-day automated or on-demand" },
        { label: "Preset Curves", value: "Smoke Probe, Capacity Ramp, Spike Surge" },
      ],
      codeOrSnippet: {
        title: "saturation-profile.json",
        language: "json",
        code: `{
  "preset": "CAPACITY_RAMP_7D",
  "concurrencyRamp": [10, 50, 150, 350, 600, 900],
  "stepDurationSec": 30,
  "abortCeilingMs": 3000,
  "maxErrorThreshold": 0.15
}`,
      },
    },
  },
  {
    id: "breakpoint-verdict",
    stepNumber: "05",
    title: "Breakpoint & Bottleneck Diagnosis",
    shortDesc: "Algorithmic discovery of Saturation Knee and root-cause bottleneck.",
    category: "Capacity Verdict",
    badgeColor: "border-destructive/40 bg-danger-subtle text-danger-text",
    icon: ShieldAlert,
    details: {
      heading: "Algorithmic Capacity Knee & Bottleneck Pinpointing",
      description:
        "STRIM compares throughput scaling against latency curves to mathematically pinpoint the Saturation Knee (safe ceiling) and Breaking Cliff. Identifies root causes: DB connection pools, CPU limits, or 429s.",
      specs: [
        { label: "Algorithm", value: "Inflection point & derivative curvature analysis" },
        { label: "Verdict Output", value: "Sustainable RPS, Knee RPS, Failure RPS" },
        { label: "Bottlenecks", value: "Latency Cliff, Error Spikes, Connection Resets" },
      ],
      codeOrSnippet: {
        title: "breakpoint-diagnosis.json",
        language: "json",
        code: `{
  "verdict": "CAPACITY_CEILING_IDENTIFIED",
  "sustainableRps": 320,
  "saturationKneeRps": 420,
  "breakingCliffRps": 610,
  "primaryBottleneck": "DB_CONNECTION_POOL_EXHAUSTION",
  "recommendation": "Increase Prisma max connection pool from 10 to 25."
}`,
      },
    },
  },
];

export function EngineFlowchart() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Auto-play animation through pipeline steps
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= FLOW_STEPS.length - 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const step = FLOW_STEPS[activeStep];

  return (
    <div className="space-y-10">
      {/* Simulation Controls Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
            <Sparkles className="size-3.5" />
            STRIM Engine Architecture
          </span>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            How the Continuous Observability & Saturation Engine Works
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow a request from application middleware to mathematical capacity verdict.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isPlaying) {
              setIsPlaying(false);
            } else {
              setActiveStep(0);
              setIsPlaying(true);
            }
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-all shadow-sm",
            isPlaying
              ? "border-brand/50 bg-brand/15 text-brand ring-2 ring-brand/20"
              : "border-border bg-card text-foreground hover:bg-surface-muted",
          )}
        >
          {isPlaying ? (
            <>
              <RotateCcw className="size-3.5 animate-spin" />
              <span>Simulating Engine Flow...</span>
            </>
          ) : (
            <>
              <Play className="size-3.5 fill-current text-brand" />
              <span>Play Interactive Walkthrough</span>
            </>
          )}
        </button>
      </div>

      {/* Horizontal Step Sequence Flowchart */}
      <div className="relative">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FLOW_STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = activeStep === idx;
            const isCompleted = activeStep > idx;

            return (
              <div
                key={s.id}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStep(idx);
                }}
                className={cn(
                  "relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 shadow-xs",
                  isCurrent
                    ? "border-brand bg-card ring-2 ring-brand/30 shadow-md scale-[1.02]"
                    : isCompleted
                    ? "border-border/80 bg-card/60 hover:border-brand/40 hover:bg-card"
                    : "border-border/60 bg-surface-muted/40 hover:border-border hover:bg-card/40",
                )}
              >
                {/* Step Connector Arrow on Desktop */}
                {idx < FLOW_STEPS.length - 1 && (
                  <div className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                    <ArrowRight
                      className={cn(
                        "size-4 transition-colors",
                        isCompleted ? "text-brand" : "text-muted-foreground/40",
                      )}
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {s.stepNumber}
                    </span>
                    <span className={cn("size-2 rounded-full", isCurrent ? "bg-brand animate-pulse" : isCompleted ? "bg-brand/60" : "bg-muted-foreground/30")} />
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={cn(
                        "grid size-8 place-items-center rounded-lg border transition-colors",
                        isCurrent
                          ? "border-brand/40 bg-brand-subtle text-brand"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground line-clamp-1">
                      {s.title}
                    </h4>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {s.shortDesc}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{s.category}</span>
                  {isCurrent && (
                    <span className="font-medium text-brand">Active</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Active Step Inspector Panel */}
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left Column: Deep dive explanation & specs */}
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <span className={cn("rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider", step.badgeColor)}>
                Step {step.stepNumber} · {step.category}
              </span>
            </div>

            <div>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {step.details.heading}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {step.details.description}
              </p>
            </div>

            {/* Specifications Cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {step.details.specs.map((sp) => (
                <div key={sp.label} className="rounded-xl border border-border bg-surface-muted/50 p-3.5">
                  <span className="text-[11px] font-medium text-muted-foreground">{sp.label}</span>
                  <p className="mt-1 text-xs font-semibold text-foreground">{sp.value}</p>
                </div>
              ))}
            </div>

            {/* Step navigation buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={activeStep === 0}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStep((p) => Math.max(0, p - 1));
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous Step
              </button>
              <button
                type="button"
                disabled={activeStep === FLOW_STEPS.length - 1}
                onClick={() => {
                  setIsPlaying(false);
                  setActiveStep((p) => Math.min(FLOW_STEPS.length - 1, p + 1));
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next Step →
              </button>
            </div>
          </div>

          {/* Right Column: Code snippet or live telemetry payload */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface-muted/80">
            <div className="flex items-center justify-between border-b border-border bg-card/70 px-4 py-2.5 text-xs">
              <span className="flex items-center gap-2 font-mono text-muted-foreground">
                <Terminal className="size-3.5 text-brand" />
                {step.details.codeOrSnippet.title}
              </span>
              <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                {step.details.codeOrSnippet.language}
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/90">
              <code>{step.details.codeOrSnippet.code}</code>
            </pre>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
