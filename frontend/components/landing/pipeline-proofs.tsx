"use client"

import * as React from "react"
import {
  Search,
  TrendingUp,
  AlertOctagon,
  Wrench,
  CheckCircle,
} from "lucide-react"

export function PipelineProofs() {
  return (
    <section
      id="methodology"
      className="scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-foreground-subtle uppercase">
            <span className="text-brand">[04]</span>
            <span>4-STEP METHODOLOGY</span>
          </div>
          <h2 className="max-w-full font-mono text-2xl font-normal text-foreground sm:text-3xl">
            From API discovery to root-cause bottleneck isolation.
          </h2>
          <p className="font-sans text-sm text-sand">
            Stop guessing why servers slow down. STRIM follows a clear 4-step
            process to reveal bottlenecks before code reaches production.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Step 1 */}
          <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-raised p-6">
            <div>
              <div className="mb-3 flex items-center justify-between font-mono text-xs text-foreground-subtle">
                <span className="font-bold text-brand">STEP 01</span>
                <span>DISCOVERY</span>
              </div>
              <h3 className="font-mono text-lg font-normal text-foreground">
                Discover &amp; Baseline
              </h3>
              <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
                Import your API or let traffic automatically map your routes.
                Measure your normal, everyday response times as a clean
                baseline.
              </p>

              <div className="mt-4 rounded border border-border bg-background p-3 font-mono text-[10px] text-sand">
                <span className="text-foreground-subtle">
                  {"// Baseline measurement"}
                </span>
                <br />
                <span className="text-success">✔</span> GET /v1/health (1.4ms)
                <br />
                <span className="text-success">✔</span> POST /v1/checkout
                (12.1ms)
                <br />
                <span className="text-foreground-subtle">
                  Median: 8ms · 95th%: 14ms
                </span>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-foreground-subtle">
              <span>Normal baseline established</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-raised p-6">
            <div>
              <div className="mb-3 flex items-center justify-between font-mono text-xs text-foreground-subtle">
                <span className="font-bold text-brand">STEP 02</span>
                <span>TRAFFIC RAMP</span>
              </div>
              <h3 className="font-mono text-lg font-normal text-foreground">
                Increase Traffic
              </h3>
              <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
                Gradually simulate realistic user growth from 500 to 50,000
                active users. Watch how response times behave as traffic mounts.
              </p>

              <div className="mt-4 rounded border border-border bg-background p-3 font-mono text-[10px] text-sand">
                <span className="text-foreground-subtle">
                  {"// Simulating user growth"}
                </span>
                <br />
                <span>500 users: 14ms (fast)</span>
                <br />
                <span>5,000 users: 19ms (stable)</span>
                <br />
                <span className="text-warning">
                  24,000 users: 58ms (slowing)
                </span>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-foreground-subtle">
              <span>Live real-time monitoring</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-raised p-6">
            <div>
              <div className="mb-3 flex items-center justify-between font-mono text-xs text-foreground-subtle">
                <span className="font-bold text-warning">STEP 03</span>
                <span>BREAKING POINT</span>
              </div>
              <h3 className="font-mono text-lg font-normal text-foreground">
                Spot The Saturation Limit
              </h3>
              <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
                Detect the exact moment response times spike or requests start
                queuing up before your server crashes completely.
              </p>

              <div className="mt-4 rounded border border-border bg-background p-3 font-mono text-[10px] text-sand">
                <span className="text-foreground-subtle">
                  {"// Limit reached"}
                </span>
                <br />
                <span className="text-warning">⚠ LIMIT @ 32,400 req/sec</span>
                <br />
                <span className="text-danger">
                  Response jumped 48ms → 480ms
                </span>
                <br />
                <span className="text-danger">Server timeout detected</span>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-foreground-subtle">
              <span>Automated limit detection</span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-raised p-6">
            <div>
              <div className="mb-3 flex items-center justify-between font-mono text-xs text-foreground-subtle">
                <span className="font-bold text-success">STEP 04</span>
                <span>DIAGNOSIS</span>
              </div>
              <h3 className="font-mono text-lg font-normal text-foreground">
                Fix The Bottleneck
              </h3>
              <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
                Get clear, actionable recommendations: whether to increase
                database connection pools, fix a slow query, or optimize server
                memory.
              </p>

              <div className="mt-4 rounded border border-border bg-background p-3 font-mono text-[10px] text-sand">
                <span className="text-foreground-subtle">
                  {"// Diagnostic fix"}
                </span>
                <br />
                <span>Bottleneck: Database connections</span>
                <br />
                <span className="text-success">
                  Fix: Increase pool from 50 → 250
                </span>
                <br />
                <span>Result: +85% more traffic supported</span>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-3 font-mono text-[10px] text-foreground-subtle">
              <span>Clear engineering solutions</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
