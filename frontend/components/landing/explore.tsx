"use client"

import * as React from "react"
import Link from "next/link"
import { Play, Pause, RotateCcw, AlertTriangle, CheckCircle, Zap, ShieldAlert, Cpu } from "lucide-react"
import { CornerCrosshairs } from "./corner-crosshairs"

type TabKey = "ramp" | "pool" | "chaos" | "flamegraph"
type ViewMode = "visual" | "config" | "curl"

export function Explore() {
  const [activeTab, setActiveTab] = React.useState<TabKey>("ramp")
  const [viewMode, setViewMode] = React.useState<ViewMode>("visual")
  const [concurrency, setConcurrency] = React.useState<number>(36500)
  const [autoPlay, setAutoPlay] = React.useState<boolean>(true)
  const [replayCount, setReplayCount] = React.useState<number>(0)

  // Infinitely running auto-play motion for the load ramp
  React.useEffect(() => {
    if (!autoPlay) return
    let step = 0
    const interval = setInterval(() => {
      step = (step + 1) % 120
      // Sine wave oscillation between 12,000 and 46,000 RPS
      const newRps = Math.floor(29000 + 16000 * Math.sin((step / 120) * 2 * Math.PI))
      setConcurrency(newRps)
    }, 120)

    return () => clearInterval(interval)
  }, [autoPlay, replayCount])

  // Derived metrics based on concurrency
  const isKnee = concurrency > 32000
  const isCritical = concurrency > 41000
  const latencyMs = isCritical
    ? Math.floor(650 + ((concurrency - 41000) / 9000) * 850)
    : isKnee
    ? Math.floor(45 + ((concurrency - 32000) / 9000) * 380)
    : Math.floor(12 + (concurrency / 32000) * 16)
  const errorRate = isCritical ? ((concurrency - 41000) / 900).toFixed(1) : isKnee ? "0.2" : "0.0"
  const threadPoolUsage = Math.min(100, Math.floor((concurrency / 42000) * 100))

  return (
    <section id="workbench" className="scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end mb-8">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-foreground-subtle uppercase tracking-wider mb-2">
              <span className="text-brand">[01]</span>
              <span>INTERACTIVE LOAD COCKPIT</span>
            </div>
            <h2 className="font-mono text-2xl sm:text-3xl font-light text-foreground">
              See how your server responds as traffic grows.
            </h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-raised px-3 py-1.5 text-sand hover:border-border transition-colors"
            >
              {autoPlay ? <Pause className="size-3 text-warning" /> : <Play className="size-3 text-success" />}
              <span>{autoPlay ? "PAUSE SIMULATION" : "RUN SIMULATION"}</span>
            </button>
            <button
              onClick={() => {
                setAutoPlay(false)
                setConcurrency(12000)
                setReplayCount((c) => c + 1)
                setTimeout(() => setAutoPlay(true), 200)
              }}
              className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-raised px-2.5 py-1.5 text-foreground-muted hover:text-foreground transition-colors"
              title="Reset Simulation"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>

        {/* Workbench Container */}
        <div className="relative rounded-xl border border-border-subtle bg-surface-raised overflow-hidden shadow-xl">
          <CornerCrosshairs />
          {/* Top Bar Tabs */}
          <div className="flex flex-wrap items-center justify-between border-b border-border-subtle bg-background px-4 py-2 gap-2">
            {/* Primary Workbench Tabs */}
            <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setActiveTab("ramp")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "ramp"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                01 Traffic Ramp Test
              </button>
              <button
                onClick={() => setActiveTab("pool")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "pool"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                02 Server Concurrency
              </button>
              <button
                onClick={() => setActiveTab("chaos")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "chaos"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                03 Error Simulation
              </button>
              <button
                onClick={() => setActiveTab("flamegraph")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "flamegraph"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                04 Timing Breakdown
              </button>
            </div>

            {/* Right Sub-View Selector */}
            <div className="flex items-center gap-1 font-mono text-[11px] bg-surface-raised p-0.5 rounded border border-border-subtle">
              <button
                onClick={() => setViewMode("visual")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === "visual" ? "bg-surface-hover text-foreground" : "text-foreground-subtle hover:text-sand"
                }`}
              >
                Visual Curve
              </button>
              <button
                onClick={() => setViewMode("config")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === "config" ? "bg-surface-hover text-foreground" : "text-foreground-subtle hover:text-sand"
                }`}
              >
                strim.config.ts
              </button>
              <button
                onClick={() => setViewMode("curl")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  viewMode === "curl" ? "bg-surface-hover text-foreground" : "text-foreground-subtle hover:text-sand"
                }`}
              >
                cURL Runner
              </button>
            </div>
          </div>

          {/* Workbench Body: Dual Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
            {/* Left Specification & Diagnosis Pane */}
            <div className="lg:col-span-5 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-border-subtle flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded border border-border-subtle bg-background px-2.5 py-1 font-mono text-[11px] text-foreground-muted mb-4">
                  <span className="text-brand">●</span>
                  <span>TARGET: api.checkout.service</span>
                </div>

                <h3 className="font-mono text-xl sm:text-2xl text-foreground font-normal leading-snug">
                  {activeTab === "ramp" && "Find where response times spike under heavy traffic."}
                  {activeTab === "pool" && "Track database and server connection limits."}
                  {activeTab === "chaos" && "Safely test error handling and timeouts."}
                  {activeTab === "flamegraph" && "See where every millisecond is spent on each call."}
                </h3>

                <p className="mt-4 font-sans text-sm text-sand leading-relaxed">
                  {activeTab === "ramp" &&
                    "Traditional load tests only show average response times, hiding the exact moment servers start queuing requests. STRIM automatically highlights your safe capacity limit before servers crash."}
                  {activeTab === "pool" &&
                    "Under heavy load, connection pools fill up before servers run out of CPU. STRIM monitors active connections and request queues so you can size pools correctly."}
                  {activeTab === "chaos" &&
                    "Simulate slow database responses, network drops, and timeouts to verify that your fallbacks and retry logic work as expected."}
                  {activeTab === "flamegraph" &&
                    "Break down each request into DNS lookup, connection handshake, server processing, and data transfer so you know exactly where bottlenecks are."}
                </p>

                {/* Real-time Status Badge */}
                <div className="mt-6 rounded-lg border border-border-subtle bg-background p-4 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-foreground-subtle">CURRENT LOAD:</span>
                    <span className="text-foreground font-bold">{concurrency.toLocaleString()} req/s</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-foreground-subtle">DIAGNOSIS:</span>
                    <span
                      className={`font-semibold flex items-center gap-1.5 ${
                        isCritical ? "text-danger" : isKnee ? "text-warning" : "text-success"
                      }`}
                    >
                      {isCritical ? (
                        <>
                          <ShieldAlert className="size-3.5" />
                          <span>BREAKING POINT EXCEEDED</span>
                        </>
                      ) : isKnee ? (
                        <>
                          <AlertTriangle className="size-3.5" />
                          <span>QUEUEING STARTS</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="size-3.5" />
                          <span>SAFE CAPACITY OK</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-foreground-subtle">RECOMMENDED CAP:</span>
                    <span className="text-success font-bold">31,500 req/s (Healthy SLA)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between font-mono text-xs">
                <span className="text-foreground-subtle">AUTOMATED PROFILE</span>
                <Link
                  href="/dashboard/runs/new"
                  className="text-brand hover:text-brand-hover flex items-center gap-1 font-bold"
                >
                  RUN THIS TEST IN CLOUD →
                </Link>
              </div>
            </div>

            {/* Right Execution & Visualizer Pane */}
            <div className="lg:col-span-7 p-6 sm:p-8 bg-background/60 flex flex-col justify-between">
              {viewMode === "visual" && (
                <div className="space-y-6">
                  {/* Slider Control */}
                  <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                    <div className="flex items-center justify-between font-mono text-xs mb-2">
                      <span className="text-foreground-muted">ADJUST CONCURRENCY / LOAD RAMP:</span>
                      <span className="text-brand font-bold">{concurrency.toLocaleString()} REQ / SEC</span>
                    </div>
                    <input
                      type="range"
                      min="5000"
                      max="50000"
                      step="500"
                      value={concurrency}
                      onChange={(e) => {
                        setAutoPlay(false)
                        setConcurrency(Number(e.target.value))
                      }}
                      className="w-full accent-brand cursor-pointer"
                    />
                    <div className="flex justify-between font-mono text-[10px] text-foreground-subtle mt-1">
                      <span>5,000 RPS (Baseline)</span>
                      <span className="text-warning">32k Knee Inflection</span>
                      <span className="text-danger">50,000 RPS (Limit)</span>
                    </div>
                  </div>

                  {/* Real-time Dynamic SVG Curve */}
                  <div className="relative rounded-lg border border-border-subtle bg-surface-sunken p-5 h-64 overflow-hidden flex flex-col justify-between">
                    {/* Scanline Effect */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-brand/5 to-transparent h-12 animate-scanline" />

                    <div className="flex items-center justify-between font-mono text-xs border-b border-border pb-2 z-10">
                      <span className="text-foreground-subtle">RESPONSE TIME VS OFFERED LOAD CURVE</span>
                      <span className="text-sand font-bold">p95: {latencyMs} ms</span>
                    </div>

                    {/* SVG Graphic with dynamic knee inflection point */}
                    <svg viewBox="0 0 500 160" className="w-full h-36 overflow-visible my-auto">
                      <defs>
                        <linearGradient id="curveGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--success)" />
                          <stop offset="60%" stopColor="var(--success)" />
                          <stop offset="75%" stopColor="var(--warning)" />
                          <stop offset="95%" stopColor="var(--danger)" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="0" y1="40" x2="500" y2="40" stroke="var(--border)" strokeDasharray="4 4" />
                      <line x1="0" y1="80" x2="500" y2="80" stroke="var(--border)" strokeDasharray="4 4" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeDasharray="4 4" />

                      {/* Knee Threshold Line */}
                      <line x1="320" y1="0" x2="320" y2="150" stroke="var(--warning)" strokeDasharray="2 2" strokeOpacity="0.4" />
                      <text x="325" y="18" fill="var(--warning)" fontSize="9" fontFamily="monospace">
                        KNEE INFLECTION (32k RPS)
                      </text>

                      {/* Exponential Response Time Curve */}
                      <path
                        d="M 10 135 C 150 132, 280 128, 340 100 C 380 75, 420 30, 480 8"
                        fill="none"
                        stroke="url(#curveGradient)"
                        strokeWidth="3.5"
                      />

                      {/* Interactive Cursor Indicator Node */}
                      {(() => {
                        const progress = (concurrency - 5000) / 45000
                        const cx = 10 + progress * 470
                        let cy = 135
                        if (progress > 0.6) {
                          const p = (progress - 0.6) / 0.4
                          cy = 135 - p * p * 125
                        } else {
                          cy = 135 - progress * 10
                        }

                        return (
                          <g>
                            <circle
                              cx={cx}
                              cy={cy}
                              r="7"
                              fill={isCritical ? "var(--danger)" : isKnee ? "var(--warning)" : "var(--brand)"}
                              className="animate-pulse"
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r="14"
                              fill="none"
                              stroke={isCritical ? "var(--danger)" : isKnee ? "var(--warning)" : "var(--brand)"}
                              strokeOpacity="0.4"
                            />
                            <line
                              x1={cx}
                              y1="0"
                              x2={cx}
                              y2="150"
                              stroke={isCritical ? "var(--danger)" : isKnee ? "var(--warning)" : "var(--brand)"}
                              strokeDasharray="2 2"
                              strokeOpacity="0.6"
                            />
                          </g>
                        )
                      })()}
                    </svg>

                    {/* Bottom Telemetry Bar */}
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border font-mono text-[11px] text-center">
                      <div>
                        <span className="text-foreground-subtle block text-[9px]">OFFERED RPS</span>
                        <span className="text-foreground font-bold">{concurrency.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-foreground-subtle block text-[9px]">p95 LATENCY</span>
                        <span className={`font-bold ${isCritical ? "text-danger" : isKnee ? "text-warning" : "text-success"}`}>
                          {latencyMs} ms
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground-subtle block text-[9px]">ERROR RATE</span>
                        <span className={`font-bold ${Number(errorRate) > 0 ? "text-danger" : "text-success"}`}>
                          {errorRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-foreground-subtle block text-[9px]">THREAD POOL</span>
                        <span className={`font-bold ${threadPoolUsage > 90 ? "text-danger" : "text-sand"}`}>
                          {threadPoolUsage}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "config" && (
                <div className="rounded-lg border border-border-subtle bg-surface-sunken p-4 font-mono text-xs overflow-x-auto text-sand h-full flex flex-col justify-between">
                  <pre className="leading-relaxed">
                    <span className="text-foreground-subtle">// strim.config.ts — Automated Saturation Profile</span>
                    {"\n"}
                    <span className="text-sand font-semibold">import</span> &#123; defineConfig &#125; <span className="text-sand font-semibold">from</span> <span className="text-success">&quot;@strim-labs/core&quot;</span>;
                    {"\n\n"}
                    <span className="text-sand font-semibold">export default</span> <span className="text-brand">defineConfig</span>(&#123;
                    {"\n"}  target: <span className="text-success">&quot;https://api.checkout.service/v1&quot;</span>,
                    {"\n"}  discovery: &#123; mode: <span className="text-success">&quot;openapi&quot;</span>, path: <span className="text-success">&quot;/docs/openapi.json&quot;</span> &#125;,
                    {"\n"}  ramp: &#123;
                    {"\n"}    startRps: <span className="text-warning">100</span>,
                    {"\n"}    targetRps: <span className="text-warning">{concurrency}</span>,
                    {"\n"}    duration: <span className="text-success">&quot;180s&quot;</span>,
                    {"\n"}    kneeDetection: &#123;
                    {"\n"}      maxP95Variance: <span className="text-warning">0.25</span>,
                    {"\n"}      autoHaltOnBreach: <span className="text-sand font-semibold">true</span>,
                    {"\n"}      slaThresholdMs: <span className="text-warning">150</span>
                    {"\n"}    &#125;
                    {"\n"}  &#125;
                    {"\n"}&#125;);
                  </pre>
                  <p className="text-[10px] text-foreground-subtle pt-3 border-t border-border">
                    Executed via distributed runner workers with sub-millisecond scheduling resolution.
                  </p>
                </div>
              )}

              {viewMode === "curl" && (
                <div className="rounded-lg border border-border-subtle bg-surface-sunken p-4 font-mono text-xs text-sand h-full flex flex-col justify-between">
                  <div className="space-y-3">
                    <p className="text-foreground-subtle"># Run load test directly from terminal without installation</p>
                    <div className="rounded bg-surface-raised p-3 border border-border-subtle text-brand break-all">
                      curl -sSL https://strim.dev/install.sh | bash && strim test \
                      {"\n"}  --target https://api.checkout.service \
                      {"\n"}  --rps {concurrency} \
                      {"\n"}  --knee-detect \
                      {"\n"}  --sla-p95 150ms
                    </div>
                  </div>
                  <p className="text-[10px] text-foreground-subtle pt-3 border-t border-border">
                    Results stream via SSE directly to your terminal and web cockpit simultaneously.
                  </p>
                </div>
              )}

              {/* Bottom Real-time Telemetry Bar */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between font-mono text-[11px] text-foreground-subtle">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-success animate-pulse" />
                  <span>STREAMING VIA SSE PROTOCOL</span>
                </div>
                <span>SAMPLE RATE: 100ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
