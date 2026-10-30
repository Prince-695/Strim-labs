"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Globe,
  Radio,
  ShieldAlert,
  Sliders,
  Timer,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { WorldGlobe3D } from "./world-globe-3d";

export function SaturationGlobeSection() {
  const [currentRps, setCurrentRps] = useState(420);

  // Derive metrics dynamically based on current scrubbed load
  let zoneIndex = 0; // 0 = Safe, 1 = Knee, 2 = Cliff
  let p95Latency = 24;
  let errorRate = 0.0;
  let deliveredThroughput = currentRps;
  let diagnosis = "Safe Band: Latency flat. Zero worker queueing, optimal headroom.";

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
    diagnosis = "Breaking Cliff: Downstream connection pool exhausted. 504 Timeouts & 429 Cascades.";
  }

  const zoneNames = ["Safe band", "Saturation knee", "Breaking cliff"];

  return (
    <section id="saturation" className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-subtle px-3.5 py-1 text-xs font-semibold text-brand-foreground dark:text-brand">
            <Globe className="size-3.5 text-brand" />
            <span>Multi-Region Capacity Engine</span>
          </div>

          <h2 className="mt-5 text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-5xl lg:text-[52px] leading-[1.08]">
            Find the knee before your cliff finds you
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Simulate realistic load across 6 distributed edge regions. STRIM dynamically increases worker concurrency to locate the exact saturation inflection point.
          </p>
        </div>

        {/* ── 2-Column Container: Left Scrubber / Right Centered 3D Globe ── */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          {/* Left Column (Span 6): Interactive Capacity Scrubber */}
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-xl sm:p-8 lg:col-span-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Sliders className="size-3.5 text-brand" />
                Scrub Simulated Traffic
              </span>

              {/* Quick Jump Buttons */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => setCurrentRps(220)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    zoneIndex === 0
                      ? "bg-brand text-brand-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Safe
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentRps(420)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    zoneIndex === 1
                      ? "bg-warning text-white font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Knee
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentRps(610)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    zoneIndex === 2
                      ? "bg-destructive text-white font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cliff
                </button>
              </div>
            </div>

            {/* Scrub Slider */}
            <div className="mt-6">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs text-muted-foreground">Applied Concurrency Load</span>
                <span className="font-mono text-2xl font-bold text-foreground">
                  {currentRps} <span className="text-xs font-normal text-muted-foreground">RPS</span>
                </span>
              </div>

              <input
                type="range"
                min={100}
                max={700}
                step={10}
                value={currentRps}
                onChange={(e) => setCurrentRps(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-muted accent-brand focus:outline-none"
              />

              <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>100 RPS</span>
                <span className="text-brand font-medium">Safe: 320</span>
                <span className="text-warning font-medium">Knee: 420</span>
                <span className="text-destructive font-medium">Cliff: 610</span>
                <span>700 RPS</span>
              </div>
            </div>

            {/* Derived Telemetry Metrics */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Activity className="size-3 text-brand" /> Throughput
                </span>
                <p className="mt-1 font-mono text-base font-bold text-foreground sm:text-lg">
                  {deliveredThroughput} <span className="text-xs font-normal text-muted-foreground">RPS</span>
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Timer className="size-3 text-warning" /> P95 Latency
                </span>
                <p
                  className={cn(
                    "mt-1 font-mono text-base font-bold sm:text-lg",
                    zoneIndex === 0 ? "text-brand" : zoneIndex === 1 ? "text-warning" : "text-destructive"
                  )}
                >
                  {p95Latency} <span className="text-xs font-normal text-muted-foreground">ms</span>
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted/30 p-3 col-span-2 sm:col-span-1">
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldAlert className="size-3 text-destructive" /> Error Rate
                </span>
                <p
                  className={cn(
                    "mt-1 font-mono text-base font-bold sm:text-lg",
                    errorRate === 0 ? "text-muted-foreground" : "text-destructive"
                  )}
                >
                  {errorRate}%
                </p>
              </div>
            </div>

            {/* Diagnosis Banner */}
            <div
              className={cn(
                "mt-5 flex items-center gap-2.5 rounded-xl border p-3 text-xs font-medium transition-all",
                zoneIndex === 0
                  ? "border-brand/30 bg-brand-subtle text-brand-foreground dark:text-brand"
                  : zoneIndex === 1
                  ? "border-warning/30 bg-warning-subtle text-warning-text"
                  : "border-destructive/30 bg-danger-subtle text-danger-text"
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
            </div>
          </div>

          {/* Right Column (Span 6): Centered 3D WebGL Globe */}
          <div className="lg:col-span-6">
            <WorldGlobe3D />
          </div>
        </div>
      </div>
    </section>
  );
}
