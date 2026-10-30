import type { Metadata } from "next";
import Link from "next/link";
import {
  Compass,
  Activity,
  Zap,
  Target,
  ArrowRight,
  ShieldAlert,
  GitCompare,
  TrendingDown,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features — 4 Pillars of Continuous API Performance",
  description:
    "Explore STRIM Labs features: Automatic API Discovery, Continuous Telemetry Observability, High-Throughput Load Testing, and Automated Breaking Point Detection.",
};

const PILLARS = [
  {
    icon: Compass,
    title: "1. Automatic API Discovery",
    tagline: "Never fly blind with undocumented shadow routes",
    description:
      "Detect every live route, method, and query variation automatically via OTel SDK telemetry, gateway route manifests, or OpenAPI 3.0/3.1 specification imports.",
    features: [
      "Zero-overhead SDK instrumentation for TypeScript, Python, and Go",
      "Dynamic route catalog with p95 latency and call volume aggregation",
      "Automatic drift detection when endpoints change in staging vs production",
      "OpenAPI 3.1 schema validation and parameter mapping",
    ],
  },
  {
    icon: Activity,
    title: "2. Real-Time Observability",
    tagline: "High-cardinality telemetry built for API engineering",
    description:
      "Monitor request rates, p50/p95/p99 latency cliffs, status code distributions, and distributed trace waterfalls without performance degradation.",
    features: [
      "Sub-second live metric streaming with SSE and WebSocket push",
      "Correlation between spike traffic and downstream dependency latency",
      "Automated anomaly and error-rate alerting (Slack, PagerDuty, Webhooks)",
      "Distributed traces with duration waterfall and status filtering",
    ],
  },
  {
    icon: Zap,
    title: "3. High-Throughput Load Engine",
    tagline: "Simulate massive traffic with microsecond precision",
    description:
      "Execute sustained, ramp-up, spike, and saturation hunt test profiles against staging and production targets with concurrency up to 1,000 virtual users.",
    features: [
      "Four test execution profiles: Sustained, Ramp-Up, Spike, and Breaking Hunt",
      "Live 500ms metric ticks and real-time abort controls",
      "Comprehensive status code distribution and error categorization",
      "Downloadable JSON execution artifacts and raw logs",
    ],
  },
  {
    icon: Target,
    title: "4. Breaking Point & Regression Diagnostics",
    tagline: "Pinpoint the exact saturation knee before your customers do",
    description:
      "Our mathematical breaking point engine detects the saturation knee (where latency turns into a cliff) and failure points (where rate limits or 5xx errors begin).",
    features: [
      "Automated saturation knee RPS & failure point calculation",
      "Bottleneck categorization: Rate Limit (429), Latency Cliff, or 5xx Failure",
      "Candidate vs baseline test run delta analysis with verdict: Improved or Regressed",
      "CI/CD regression gating to block PRs that degrade p95 latency by >15%",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            Engineering Deep Dive
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            The Complete Platform for API Reliability
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg leading-relaxed">
            STRIM Labs merges API exploration, live observability, distributed load generation, and saturation diagnostics into one unified developer tool.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="mt-16 space-y-12 sm:mt-24">
          {PILLARS.map((pillar, idx) => (
            <div
              key={pillar.title}
              className="rounded-2xl border border-border bg-card/60 p-8 sm:p-12 shadow-sm transition-all hover:border-brand/40"
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                <div className="space-y-4 lg:max-w-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <pillar.icon className="size-5" />
                    </div>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                      Pillar 0{idx + 1}
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {pillar.title}
                  </h2>
                  <p className="text-sm font-semibold text-brand">{pillar.tagline}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="flex-1 lg:max-w-md rounded-xl border border-border bg-surface-muted/40 p-6 space-y-3">
                  <span className="text-xs font-mono font-semibold text-foreground uppercase tracking-wider">
                    Core Capabilities
                  </span>
                  <ul className="space-y-2.5 text-xs text-muted-foreground">
                    {pillar.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <span className="text-brand font-bold mt-0.5">&bull;</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CI/CD Integration Callout */}
        <div className="mt-16 rounded-2xl border border-border bg-ink p-8 sm:p-12 text-ink-foreground shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-brand uppercase tracking-wider">
                <Terminal className="size-4" /> Automated CI/CD Regression Gate
              </div>
              <h3 className="text-xl font-bold sm:text-2xl">
                Block PRs that degrade API capacity
              </h3>
              <p className="text-xs text-ink-muted max-w-xl leading-relaxed">
                Run automated load tests in your GitHub Actions or GitLab pipeline. If candidate p95 latency regresses by &gt;15% or error rate increases, the build fails automatically.
              </p>
            </div>
            <Button asChild className="bg-brand text-brand-foreground hover:bg-brand-strong shrink-0">
              <Link href="/sign-up">
                Start Free in CI
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
