"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitPullRequest,
  Lock,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Timer,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CapacityGauge } from "../capacity-gauge";
import { Reveal } from "../fx/reveal";
import { TiltCard } from "../fx/tilt-card";
import { buttonVariants } from "../ui/button";
import { cn } from "@/lib/utils";

export function SectionHeading({ title, body, center }: { title: string; body?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <h2 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px] text-foreground">{title}</h2>
      {body && <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">{body}</p>}
    </div>
  );
}

/**
 * Interactive 3-Zone Capacity Playground.
 * Allows the user to scrub simulated RPS throughput and see how latency,
 * throughput, and error rates transition across Safe Band, Saturation Knee, and Breaking Cliff.
 */
export function SpectrumSection() {
  const [currentRps, setCurrentRps] = useState(420);

  // Derive metrics based on simulated load
  let zoneIndex = 0; // 0 = Safe, 1 = Knee, 2 = Cliff
  let p95Latency = 24;
  let errorRate = 0.0;
  let deliveredThroughput = currentRps;
  let diagnosis = "Latency flat. Zero worker queueing, optimal headroom.";

  if (currentRps <= 320) {
    zoneIndex = 0;
    p95Latency = Math.round(22 + (currentRps / 320) * 16);
    errorRate = 0.0;
    deliveredThroughput = currentRps;
    diagnosis = "Safe Band: Latency is flat, zero queue buildup, throughput scales 1:1 with load.";
  } else if (currentRps <= 480) {
    zoneIndex = 1;
    const progress = (currentRps - 320) / 160;
    p95Latency = Math.round(38 + progress * 140);
    errorRate = +(progress * 0.4).toFixed(2);
    deliveredThroughput = Math.round(320 + progress * 100);
    diagnosis = "Saturation Knee: Capacity ceiling reached. Worker queues forming, latency curving upward.";
  } else {
    zoneIndex = 2;
    const progress = (currentRps - 480) / 220;
    p95Latency = Math.round(180 + progress * 1420);
    errorRate = +(0.4 + progress * 16.5).toFixed(1);
    deliveredThroughput = Math.round(420 - progress * 95);
    diagnosis = "Breaking Cliff: Downstream connection pool exhausted. Surges in 504 Gateway Timeouts & 429s.";
  }

  const cards = [
    {
      id: "safe",
      name: "Safe band",
      range: "0 – 320 RPS",
      rpsTarget: 220,
      active: zoneIndex === 0,
      tone: "bg-brand text-brand",
      borderTone: "border-brand/50 shadow-brand/10",
      badge: "border-brand/40 bg-brand-subtle text-success-text",
      points: ["P95 latency stays flat (< 40 ms)", "Throughput scales 1:1 with traffic", "0.00% errors and timeouts"],
      body: "Optimal production headroom. Adding traffic only adds delivered throughput.",
    },
    {
      id: "knee",
      name: "Saturation knee",
      range: "320 – 480 RPS",
      rpsTarget: 420,
      active: zoneIndex === 1,
      tone: "bg-warning text-warning",
      borderTone: "border-warning/50 shadow-warning/10",
      badge: "border-warning/40 bg-warning-subtle text-warning-text",
      points: ["Latency curves up sharply", "Throughput starts plateauing", "Worker concurrency saturated"],
      body: "The inflection point. Requests succeed, but each extra user degrades everyone's response time.",
    },
    {
      id: "cliff",
      name: "Breaking cliff",
      range: "480+ RPS",
      rpsTarget: 610,
      active: zoneIndex === 2,
      tone: "bg-destructive text-destructive",
      borderTone: "border-destructive/50 shadow-destructive/10",
      badge: "border-destructive/40 bg-danger-subtle text-danger-text",
      points: ["504 timeouts & 429 rate limits", "Connection pool exhaustion", "Tail latency runs away (1,000+ ms)"],
      body: "Failure cascade. Traffic collapses service workers and crashes upstream dependencies.",
    },
  ];

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <SectionHeading
          title="One result, three zones"
          body="Instead of static log dumps, STRIM continuously measures and animates the exact boundary between safety, saturation, and failure."
        />

        {/* Quick zone jump buttons */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm">
          <span className="px-2 text-xs font-medium text-muted-foreground">Jump to:</span>
          <button
            type="button"
            onClick={() => setCurrentRps(220)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              zoneIndex === 0
                ? "bg-brand/20 text-brand font-bold ring-1 ring-brand/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Safe (220 RPS)
          </button>
          <button
            type="button"
            onClick={() => setCurrentRps(420)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              zoneIndex === 1
                ? "bg-warning/20 text-warning font-bold ring-1 ring-warning/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Knee (420 RPS)
          </button>
          <button
            type="button"
            onClick={() => setCurrentRps(610)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
              zoneIndex === 2
                ? "bg-destructive/20 text-destructive font-bold ring-1 ring-destructive/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Cliff (610 RPS)
          </button>
        </div>
      </div>

      {/* Interactive Simulation Dashboard */}
      <Reveal className="mt-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          {/* Capacity Gauge with live scrubbed RPS */}
          <CapacityGauge
            example
            currentRps={currentRps}
            currentLabel="Simulated Traffic"
            breakingPoint={{
              sustainableRps: 320,
              kneeRps: 420,
              failureRps: 610,
              bottleneck: "LATENCY_CLIFF",
              verdict: "Example",
            }}
          />

          {/* Interactive Scrub Slider Controls */}
          <div className="mt-8 rounded-xl border border-border bg-surface-muted/50 p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <label htmlFor="load-slider" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sliders className="size-4 text-brand" />
                Scrub Simulated Load Throughput
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {currentRps} RPS
                </span>
                <span className="text-xs text-muted-foreground">applied</span>
              </div>
            </div>

            <div className="mt-3">
              <input
                id="load-slider"
                type="range"
                min={100}
                max={700}
                step={10}
                value={currentRps}
                onChange={(e) => setCurrentRps(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-border accent-brand focus:outline-none"
              />
              <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>100 RPS</span>
                <span className="text-brand font-medium">Safe Limit: 320 RPS</span>
                <span className="text-warning font-medium">Knee: 420 RPS</span>
                <span className="text-destructive font-medium">Cliff: 610 RPS</span>
                <span>700 RPS</span>
              </div>
            </div>

            {/* Live Telemetry Readout Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Activity className="size-3 text-brand" /> Throughput
                </span>
                <p className="mt-1 font-mono text-lg font-bold text-foreground">
                  {deliveredThroughput} <span className="text-xs font-normal text-muted-foreground">RPS</span>
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Timer className="size-3 text-warning" /> P95 Latency
                </span>
                <p className={cn(
                  "mt-1 font-mono text-lg font-bold",
                  zoneIndex === 0 ? "text-brand" : zoneIndex === 1 ? "text-warning" : "text-destructive"
                )}>
                  {p95Latency} <span className="text-xs font-normal text-muted-foreground">ms</span>
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldAlert className="size-3 text-destructive" /> Error Ratio
                </span>
                <p className={cn(
                  "mt-1 font-mono text-lg font-bold",
                  errorRate === 0 ? "text-muted-foreground" : "text-destructive"
                )}>
                  {errorRate}%
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Zap className="size-3 text-brand" /> Active Zone
                </span>
                <p className={cn(
                  "mt-1 text-sm font-semibold capitalize",
                  zoneIndex === 0 ? "text-brand" : zoneIndex === 1 ? "text-warning" : "text-destructive"
                )}>
                  {cards[zoneIndex].name}
                </p>
              </div>
            </div>

            {/* Diagnosis Banner */}
            <motion.div
              key={zoneIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mt-4 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs font-medium",
                zoneIndex === 0
                  ? "border-brand/30 bg-brand-subtle/70 text-success-text"
                  : zoneIndex === 1
                  ? "border-warning/30 bg-warning-subtle/70 text-warning-text"
                  : "border-destructive/30 bg-danger-subtle/70 text-danger-text"
              )}
            >
              {zoneIndex === 0 ? (
                <CheckCircle2 className="size-4 shrink-0 text-brand" />
              ) : zoneIndex === 1 ? (
                <AlertTriangle className="size-4 shrink-0 text-warning" />
              ) : (
                <ShieldAlert className="size-4 shrink-0 text-destructive" />
              )}
              <span>{diagnosis}</span>
            </motion.div>
          </div>
        </div>
      </Reveal>

      {/* 3 Zone Cards: Clickable to snap simulator */}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.name} delay={i * 0.08}>
            <div
              onClick={() => setCurrentRps(c.rpsTarget)}
              className={cn(
                "group relative h-full cursor-pointer rounded-2xl border transition-all duration-300",
                c.active
                  ? `border-2 ${c.borderTone} ring-4 ring-brand/10 shadow-lg scale-[1.01]`
                  : "border-border bg-card/70 hover:border-brand/40 hover:bg-card shadow-card",
              )}
            >
              <TiltCard className="h-full rounded-2xl" max={4}>
                <div className="h-full rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("size-2.5 rounded-full ring-2", c.tone)} aria-hidden />
                      <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{c.name}</h3>
                    </div>
                    <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium", c.badge)}>
                      {c.range}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {c.body}
                  </p>

                  <ul className="mt-4 space-y-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
                    {c.points.map((p) => (
                      <li key={p} className="flex items-center gap-2">
                        <span className={cn("size-1.5 shrink-0 rounded-full", c.tone)} aria-hidden />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex items-center gap-1.5 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                    <span>Simulate {c.range}</span>
                    <ArrowRight className="size-3" />
                  </div>
                </div>
              </TiltCard>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function WorkflowSection() {
  const steps = [
    {
      icon: Radar,
      title: "1. Zero-config integration",
      body: "Add @strim/sdk middleware to your Hono, Express, or Next.js server. Endpoints and methods are automatically mapped without writing test suites.",
    },
    {
      icon: Zap,
      title: "2. Automated 7-day saturation",
      body: "STRIM runs weekly multi-worker capacity ramps or on-demand presets: Smoke Probe, Spike Surge, and Breaking Point Hunt.",
    },
    {
      icon: GitPullRequest,
      title: "3. Precision breakpoint verdict",
      body: "Pinpoint the exact saturation knee and breaking cliff. Compare builds against baseline performance and gate regressions in CI/CD.",
    },
  ];
  return (
    <section className="border-y border-border bg-surface-muted/50">
      <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
        <SectionHeading title="From endpoint to decision in three steps" />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.1} className="h-full">
                <div className="relative h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <span className="mb-5 grid size-11 place-items-center rounded-xl border border-brand/20 bg-brand-subtle text-brand dark:bg-brand/10">
                    <s.icon className="size-5 text-brand" />
                  </span>
                  <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  {i < steps.length - 1 && (
                    <ArrowRight className="absolute -right-[19px] top-1/2 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground md:block" aria-hidden />
                  )}
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SecuritySection() {
  const items = [
    {
      icon: ShieldCheck,
      title: "SSRF & loopback protection",
      body: "Target URLs are checked against private IP ranges and internal network scopes before any worker opens a socket.",
    },
    {
      icon: Lock,
      title: "Encrypted API keys & secrets",
      body: "Project API keys (strim_live_...) and headers are encrypted at rest with AES-256-GCM. Sensitive keys are never logged in CI.",
    },
    {
      icon: Timer,
      title: "Sub-200ms worker cancellation",
      body: "Instant abort cleanly tears down all in-flight TCP connections and worker threads without leaking memory or leaving sockets open.",
    },
  ];
  return (
    <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
      <SectionHeading
        title="Built to test responsibly"
        body="Load testing sends real traffic. STRIM is engineered so you stay in total control of concurrency ceilings, timeout thresholds, and safety boundaries."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-xs">
              <span className="grid size-10 place-items-center rounded-lg border border-brand/20 bg-brand-subtle dark:bg-brand/10">
                <it.icon className="size-5 text-brand" aria-hidden />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-foreground">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card via-surface-muted/40 to-surface-muted p-8 text-center sm:p-16 shadow-2xl">
        <div className="bg-grid mask-vignette pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute left-1/2 top-0 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[120px] dark:bg-brand/25" />
        <div className="relative z-10">
          <h2 className="mx-auto max-w-2xl text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[44px] text-foreground">
            Know your limit before your users find it.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-muted-foreground">
            Plug in <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-foreground">@strim/sdk</code> or run an instant Smoke Probe. Zero scripts to write.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "shadow-lg shadow-brand/20")}>
              Create a workspace <ArrowRight className="size-4" />
            </Link>
            <Link href="/how-it-works" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Explore the engine
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
