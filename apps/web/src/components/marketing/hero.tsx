"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Check,
  Copy,
  Radio,
  Terminal,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";
import { BackgroundCubesGrid } from "../ui/background-cubes-grid";

const ROUTES = [
  {
    id: "checkout",
    path: "/api/checkout/process",
    method: "POST",
    rps: 342,
    p50: 24,
    p95: 41,
    p99: 88,
    errorRate: 0.0,
    status: "healthy",
    zone: "Safe Band",
    zoneColor: "text-brand bg-brand-subtle border-brand/30",
    kneeRps: 480,
    cliffRps: 650,
  },
  {
    id: "profile",
    path: "/api/users/profile",
    method: "GET",
    rps: 520,
    p50: 16,
    p95: 114,
    p99: 310,
    errorRate: 0.24,
    status: "knee",
    zone: "Saturation Knee",
    zoneColor: "text-warning bg-warning-subtle border-warning/30",
    kneeRps: 450,
    cliffRps: 580,
  },
  {
    id: "search",
    path: "/v1/search/stream",
    method: "GET",
    rps: 710,
    p50: 85,
    p95: 840,
    p99: 1820,
    errorRate: 11.2,
    status: "cliff",
    zone: "Breaking Cliff",
    zoneColor: "text-destructive bg-danger-subtle border-destructive/30",
    kneeRps: 520,
    cliffRps: 680,
  },
] as const;

export function Hero() {
  const [selectedRoute, setSelectedRoute] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [bufferBars, setBufferBars] = useState<number[]>([
    28, 42, 50, 48, 65, 58, 70, 84, 76, 92, 80, 88, 95, 82, 90, 100,
  ]);

  const active = ROUTES[selectedRoute];

  // Dynamic 500ms sliding buffer bar animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBufferBars((prev) => {
        const base = active.status === "cliff" ? 85 : active.status === "knee" ? 60 : 35;
        const jitter = Math.floor((Math.random() - 0.45) * 35);
        const nextVal = Math.min(100, Math.max(15, base + jitter));
        return [...prev.slice(1), nextVal];
      });
    }, 500);

    return () => clearInterval(interval);
  }, [active.status]);

  function copyInstall() {
    navigator.clipboard.writeText("bun add @strim/sdk");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      <BackgroundCubesGrid />

      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* ── Main Display Headline with Squircle Keyword ── */}
        <div className="mx-auto mt-6 max-w-4xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: EASE_OUT }}
            className="text-4xl font-medium text-foreground sm:text-6xl lg:text-[60px] lg:leading-[1.06]"
          >
            Every endpoint bottleneck.
            <br />
            <span className="relative inline-block mt-1 sm:mt-2">
              <span className="relative z-10 inline-block rounded-[18px] bg-brand px-3.5 py-0.5 text-brand-foreground shadow-lg shadow-brand/25 sm:px-5 sm:py-1">
                instantly
              </span>
            </span>{" "}
            diagnosed.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16, ease: EASE_OUT }}
            className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Continuous 500ms lock-free ring buffer telemetry, automated weekly saturation knee curves, and zero-script load profiling for modern TypeScript backends.
          </motion.p>
        </div>

        {/* ── Interactive Install Box (Shelf-style squircle input box) ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.22, ease: EASE_OUT }}
          className="mx-auto mt-8 flex max-w-md flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:gap-2 rounded-[20px] border border-border bg-card/80 p-2 shadow-xl backdrop-blur-xl"
        >
          <div
            onClick={copyInstall}
            className="flex flex-1 cursor-pointer items-center justify-between rounded-xl bg-surface-muted/60 px-3.5 py-2 font-mono text-xs text-foreground transition-colors hover:bg-surface-muted"
          >
            <div className="flex items-center gap-2">
              <Terminal className="size-3.5 text-brand" />
              <span>bun add @strim/sdk</span>
            </div>
            <button
              type="button"
              className="ml-2 text-muted-foreground hover:text-foreground"
              aria-label="Copy install command"
            >
              {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
            </button>
          </div>

          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "md" }),
              "rounded-xl bg-brand font-semibold text-brand-foreground hover:bg-brand-strong px-5 shadow-md shadow-brand/20 transition-all"
            )}
          >
            <span>Launch console</span>
            <ArrowRight className="size-4" />
          </Link>
        </motion.div>

        {/* ── Full-Width Interactive Product UI Cockpit (Shelf-inspired Window) ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: EASE_OUT }}
          className="mt-14 overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl ring-1 ring-border/50"
        >
          {/* Cockpit Window Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-5 py-3.5 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-red-500/80" />
              <span className="size-3 rounded-full bg-amber-500/80" />
              <span className="size-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-xs font-medium text-muted-foreground hidden sm:inline">
                strim-cockpit // ring-buffer-active
              </span>
            </div>

            {/* Route Switcher Buttons */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background p-1">
              {ROUTES.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoute(idx)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                    selectedRoute === idx
                      ? "bg-surface-raised text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      r.status === "healthy"
                        ? "bg-brand"
                        : r.status === "knee"
                        ? "bg-warning"
                        : "bg-destructive"
                    )}
                  />
                  <span>{r.path}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-mono text-brand font-medium">
                <Radio className="size-3 animate-pulse" />
                500ms telemetry
              </span>
            </div>
          </div>

          {/* Cockpit Inner Body */}
          <div className="p-5 sm:p-7">
            {/* Top Route Overview Card */}
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded-md border border-border bg-surface-raised px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                    {active.method}
                  </span>
                  <span className="font-mono text-base font-semibold text-foreground sm:text-lg">
                    {active.path}
                  </span>
                  <span className={cn("rounded-md border px-2.5 py-0.5 text-xs font-semibold", active.zoneColor)}>
                    {active.zone}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lock-free circular ring buffer with &lt; 0.12ms middleware recording overhead.
                </p>
              </div>

              {/* Status Diagnosis */}
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-border bg-card px-3.5 py-2 text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Throughput
                  </span>
                  <span className="font-mono text-lg font-bold text-foreground">
                    {active.rps} <span className="text-xs font-normal text-muted-foreground">RPS</span>
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card px-3.5 py-2 text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    P95 Latency
                  </span>
                  <span
                    className={cn(
                      "font-mono text-lg font-bold",
                      active.status === "healthy"
                        ? "text-brand"
                        : active.status === "knee"
                        ? "text-warning"
                        : "text-destructive"
                    )}
                  >
                    {active.p95} <span className="text-xs font-normal text-muted-foreground">ms</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom 2-Column Telemetry Display */}
            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Left: 500ms Sliding Buffer Real-time Histogram */}
              <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-brand" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Continuous 500ms Lock-Free Ring Buffer
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    16 slots / 8.0s window
                  </span>
                </div>

                {/* Animated Histogram Bars */}
                <div className="mt-5 flex h-28 items-end gap-1.5 sm:gap-2">
                  {bufferBars.map((height, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        style={{ height: `${height}%` }}
                        className={cn(
                          "w-full rounded-t-md transition-all duration-300",
                          active.status === "cliff"
                            ? "bg-destructive/80 hover:bg-destructive"
                            : active.status === "knee"
                            ? "bg-warning/80 hover:bg-warning"
                            : "bg-brand/80 hover:bg-brand"
                        )}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                  <span>-8.0s (oldest slot)</span>
                  <span className="text-brand font-semibold">Live Slot (0ms)</span>
                </div>
              </div>

              {/* Right: Saturation Knee & Breaking Cliff Breakdown */}
              <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-muted/30 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-warning" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Automated Knee Detection
                    </span>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5">
                      <span className="text-xs text-muted-foreground">Saturation Knee:</span>
                      <span className="font-mono text-xs font-bold text-warning">{active.kneeRps} RPS</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5">
                      <span className="text-xs text-muted-foreground">Breaking Cliff:</span>
                      <span className="font-mono text-xs font-bold text-destructive">{active.cliffRps} RPS</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-2.5">
                      <span className="text-xs text-muted-foreground">Error Ratio:</span>
                      <span className="font-mono text-xs font-bold text-foreground">{active.errorRate}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">CI/CD Gate Status</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold",
                      active.status === "healthy"
                        ? "bg-brand-subtle text-brand"
                        : active.status === "knee"
                        ? "bg-warning-subtle text-warning"
                        : "bg-danger-subtle text-destructive"
                    )}
                  >
                    {active.status === "healthy" ? "PASSED" : active.status === "knee" ? "WARNING" : "FAILED"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
