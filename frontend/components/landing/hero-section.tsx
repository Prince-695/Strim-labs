import * as React from "react"
import Link from "next/link"
import { Play, Terminal, Activity, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
      {/* Background Subtle Gradient Overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="size-[540px] rounded-full bg-brand/5 blur-[120px]" />
        <div className="size-[320px] rounded-full bg-sand/5 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow Chip */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-mono text-sand">
            <span className="flex size-1.5 rounded-full bg-brand" />
            <span>REAL API LOAD TESTING & CAPACITY ANALYSIS</span>
          </div>

          {/* Headline */}
          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl font-heading">
            Find your API&apos;s breaking point <br className="hidden sm:inline" />
            <span className="text-sand font-serif italic font-normal">before production does.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-base text-foreground-muted sm:text-lg leading-relaxed">
            Run controlled, distributed load tests against verified targets. Detect saturation knees,
            calculate sustainable throughput, and compare build regressions with mathematical rigor.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              render={<Link href="/dashboard" />}
              className="gap-2 bg-brand text-white hover:bg-brand-hover shadow-lg shadow-brand/20 font-medium px-6"
            >
              <Play className="size-4 fill-current" />
              <span>Launch Dashboard</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              render={
                <a
                  href="https://strim-labs.onrender.com/swagger/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              className="gap-2 border-border bg-surface/50 text-foreground hover:bg-surface-raised px-6"
            >
              <Terminal className="size-4 text-sand" />
              <span>Interactive API Spec</span>
            </Button>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-foreground-subtle">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" />
              <span>Mandatory DNS TXT Verification</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-sand" />
              <span>High-Throughput Open & Closed Models</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-brand" />
              <span>Sub-Second SSE Live Streaming</span>
            </div>
          </div>

          {/* Technical Telemetry Preview Mock */}
          <div className="mt-14 w-full max-w-5xl rounded-xl border border-border bg-surface/90 p-2 shadow-2xl shadow-black/60 backdrop-blur-md">
            <div className="flex h-9 items-center justify-between rounded-t-lg border-b border-border-subtle bg-surface-raised px-4">
              <div className="flex items-center gap-2">
                <div className="size-2.5 rounded-full bg-danger/80" />
                <div className="size-2.5 rounded-full bg-warning/80" />
                <div className="size-2.5 rounded-full bg-success/80" />
                <span className="ml-2 font-mono text-xs text-foreground-muted">
                  strim run --target api.checkout.prod --profile sustained
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status="running" size="sm" />
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 border-b border-border-subtle bg-surface">
              <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3 text-left">
                <p className="font-mono text-[10px] text-foreground-subtle uppercase">Target RPS</p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground">1,250 <span className="text-xs font-normal text-foreground-subtle">RPS</span></p>
                <p className="text-[10px] font-mono text-success mt-0.5">Offered 100% matched</p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3 text-left">
                <p className="font-mono text-[10px] text-foreground-subtle uppercase">P95 Tail Latency</p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground">42.8 <span className="text-xs font-normal text-foreground-subtle">ms</span></p>
                <p className="text-[10px] font-mono text-warning mt-0.5">Knee knee threshold: 120ms</p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3 text-left">
                <p className="font-mono text-[10px] text-foreground-subtle uppercase">Observed Error Rate</p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground">0.02%</p>
                <p className="text-[10px] font-mono text-success mt-0.5">SLA limit: 1.00%</p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3 text-left">
                <p className="font-mono text-[10px] text-foreground-subtle uppercase">Capacity Verdict</p>
                <p className="mt-1 font-mono text-sm font-bold text-success">SUSTAINABLE</p>
                <p className="text-[10px] font-mono text-foreground-subtle mt-0.5">Confidence: high (100k reqs)</p>
              </div>
            </div>

            <div className="p-4 bg-background/50 rounded-b-lg text-left font-mono text-xs text-foreground-muted space-y-1">
              <div className="flex items-center justify-between text-[11px] text-foreground-subtle border-b border-border-subtle/50 pb-2 mb-2">
                <span>[00:24.1] Dispatched 30,000 HTTP POST calls to /api/v1/checkout</span>
                <span className="text-brand">HTTP 200: 29,994 | HTTP 500: 6</span>
              </div>
              <p className="text-sand text-[11px]">
                ⚡ Analysis: Queue concurrency remains stable. No knee dispersion detected up to 1,250 RPS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
