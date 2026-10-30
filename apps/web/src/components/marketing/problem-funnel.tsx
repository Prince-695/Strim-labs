"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  Flame,
  HardDrive,
  Layers,
  Radio,
  Server,
  ShieldAlert,
  WifiOff,
  ZapOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHAOS_ITEMS = [
  { icon: AlertCircle, label: "504 Gateway Timeout" },
  { icon: Database, label: "Postgres Pool Starved (max: 20)", color: "text-amber-500" },
  { icon: Flame, label: "Docker OOM Crash (Exit 137)", color: "text-destructive" },
  { icon: WifiOff, label: "TCP Socket Exhaustion", color: "text-orange-500" },
  { icon: Layers, label: "Unindexed WHERE Clauses", color: "text-amber-500" },
  { icon: ZapOff, label: "429 Rate Limits (Stripe/Redis)", color: "text-destructive" },
  { icon: Clock, label: "GC Pause Spikes (> 450ms)", color: "text-amber-500" },
  { icon: Server, label: "Cascading Upstream Timeouts", color: "text-destructive" },
  { icon: HardDrive, label: "Worker Queue Saturation", color: "text-orange-500" },
  { icon: Cpu, label: "Event Loop Lag (> 120ms)", color: "text-amber-500" },
  { icon: ShieldAlert, label: "DNS Resolver Failures", color: "text-destructive" },
  { icon: AlertTriangle, label: "Connection Leak in Goroutines", color: "text-amber-500" },
];

export function ProblemFunnel() {
  return (
    <section id="funnel" className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 text-center">

        {/* Headline */}
        <h2 className="mt-5 text-3xl tracking-[-0.035em] text-foreground sm:text-5xl lg:text-[54px] leading-[1.08]">
          Your backends break in the dark
        </h2>

        {/* Subtitle */}
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Traditional APMs only capture 1-minute averages after users complain. Unindexed queries, connection pool leaks, and memory bloat stay invisible until peak traffic strikes.
        </p>

        {/* ── Organic Rolling Dome with Scattered Failure Badges ── */}
        <div className="relative mt-6 sm:mt-10">

          {/* Scattered Chaos Badges Rolling along the curve */}
          <div className="relative z-10 mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 px-4 pb-8">
            {CHAOS_ITEMS.map((item, idx) => (
              <motion.div key={idx}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-full border border-border bg-card/90 px-3.5 py-2 text-xs font-medium text-foreground shadow-md backdrop-blur-md transition-all hover:border-brand/40 hover:shadow-lg sm:px-4 sm:py-2.5 sm:text-sm"
                )}
              >
                <item.icon className={cn("size-3.5 sm:size-4 shrink-0", item.color)} />
                <span>{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
