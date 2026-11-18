"use client"

import * as React from "react"
import { Cpu, ShieldCheck, Zap, Activity } from "lucide-react"
import { CornerCrosshairs } from "./corner-crosshairs"

export function Stats() {
  return (
    <section id="benchmarks" className="scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section Index Header */}
        <div className="flex flex-col items-start gap-3 mb-12">
          <div className="flex items-center gap-2 font-mono text-xs text-foreground-subtle uppercase tracking-wider">
            <span className="text-brand">[02]</span>
            <span>ACCURATE BENCHMARKS</span>
          </div>
          <h2 className="font-mono text-2xl sm:text-3xl font-normal text-foreground max-w-full">
            Know your system&apos;s limits with crystal-clear accuracy.
          </h2>
          <p className="font-sans text-base text-sand leading-relaxed">
            Most load test tools report misleading averages or slow down your computer. STRIM measures real server response times under heavy traffic so you can prevent outages before they happen.
          </p>
        </div>

        {/* 4-Metric High-Density Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1 */}
          <div className="relative rounded-xl border border-border-subtle bg-surface-raised p-6 sm:p-7 flex flex-col justify-between hover:border-border transition-colors">
            <CornerCrosshairs colorClass="text-sand/30" />
            <div>
              <div className="flex items-center justify-between text-foreground-subtle mb-4">
                <span className="font-mono text-xs font-semibold">[CAPACITY 01]</span>
                <Cpu className="size-4 text-brand" />
              </div>
              <p className="font-mono text-4xl font-normal text-foreground tracking-tight">
                500k<span className="text-brand text-2xl">+</span>
              </p>
              <p className="mt-2 font-mono text-sm text-sand font-medium">
                Simultaneous Virtual Users
              </p>
              <p className="mt-2 font-sans text-xs text-foreground-muted leading-relaxed">
                Simulate heavy real-world traffic from a single test without freezing your machine or dropping connections.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border font-mono text-[10px] text-foreground-subtle">
              <span>Up to 500k concurrent users</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="relative rounded-xl border border-border-subtle bg-surface-raised p-6 sm:p-7 flex flex-col justify-between hover:border-border transition-colors">
            <CornerCrosshairs colorClass="text-sand/30" />
            <div>
              <div className="flex items-center justify-between text-foreground-subtle mb-4">
                <span className="font-mono text-xs font-semibold">[PRECISION 02]</span>
                <ShieldCheck className="size-4 text-success" />
              </div>
              <p className="font-mono text-4xl font-normal text-foreground tracking-tight">
                100<span className="text-sand text-2xl font-normal">%</span>
              </p>
              <p className="mt-2 font-mono text-sm text-sand font-medium">
                Real Measured Latency
              </p>
              <p className="mt-2 font-sans text-xs text-foreground-muted leading-relaxed">
                Every millisecond is accounted for. See DNS, connection setup, and backend processing times separately with zero fake zeros.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border font-mono text-[10px] text-foreground-subtle">
              <span>Transparent timing breakdown</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="relative rounded-xl border border-border-subtle bg-surface-raised p-6 sm:p-7 flex flex-col justify-between hover:border-border transition-colors">
            <CornerCrosshairs colorClass="text-sand/30" />
            <div>
              <div className="flex items-center justify-between text-foreground-subtle mb-4">
                <span className="font-mono text-xs font-semibold">[ACCURACY 03]</span>
                <Zap className="size-4 text-warning" />
              </div>
              <p className="font-mono text-4xl font-normal text-foreground tracking-tight">
                0<span className="text-sand text-2xl font-normal">%</span>
              </p>
              <p className="mt-2 font-mono text-sm text-sand font-medium">
                Test Runner Lag
              </p>
              <p className="mt-2 font-sans text-xs text-foreground-muted leading-relaxed">
                Your test results reflect your server&apos;s true speed, never slowed down or contaminated by the test runner itself.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border font-mono text-[10px] text-foreground-subtle">
              <span>Hardware-level clock precision</span>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="relative rounded-xl border border-border-subtle bg-surface-raised p-6 sm:p-7 flex flex-col justify-between hover:border-border transition-colors">
            <CornerCrosshairs colorClass="text-sand/30" />
            <div>
              <div className="flex items-center justify-between text-foreground-subtle mb-4">
                <span className="font-mono text-xs font-semibold">[LIVE FEED 04]</span>
                <Activity className="size-4 text-brand" />
              </div>
              <p className="font-mono text-4xl font-normal text-foreground tracking-tight">
                &lt;1<span className="text-sand text-2xl font-normal">s</span>
              </p>
              <p className="mt-2 font-mono text-sm text-sand font-medium">
                Live Dashboard Updates
              </p>
              <p className="mt-2 font-sans text-xs text-foreground-muted leading-relaxed">
                Watch response times, error rates, and traffic volume update live on your screen every single second as tests run.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border font-mono text-[10px] text-foreground-subtle">
              <span>Real-time live streaming</span>
            </div>
          </div>
        </div>

        {/* Methodology Footnote */}
        <div className="mt-6 rounded-lg border border-border bg-surface-raised/60 p-4 font-mono text-xs text-foreground-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>
            Built for production scale. Tested against high-traffic microservices and APIs.
          </span>
          <span className="text-sand shrink-0">
            100% REPRODUCIBLE · OPEN SOURCE APACHE 2.0
          </span>
        </div>
      </div>
    </section>
  )
}
