"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Zap,
  Activity,
  Radio,
  Cpu,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CornerCrosshairs } from "./corner-crosshairs"
import { AsciiDataBackground } from "./ascii-data-background"

type HeroPill = "discovery" | "monitoring" | "capacity"
const PILLS: HeroPill[] = ["discovery", "monitoring", "capacity"]

export function Hero() {
  const [copied, setCopied] = React.useState(false)
  const [activePill, setActivePill] = React.useState<HeroPill>("discovery")
  const [isPaused, setIsPaused] = React.useState(false)

  // Infinite autorun loop: cycles discovery -> monitoring -> capacity -> discovery...
  React.useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      setActivePill((prev) => {
        const nextIndex = (PILLS.indexOf(prev) + 1) % PILLS.length
        return PILLS[nextIndex]
      })
    }, 5500)
    return () => clearInterval(interval)
  }, [isPaused])

  // Pill 1: Live rolling discovery requests
  const [discoveryIndex, setDiscoveryIndex] = React.useState(0)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setDiscoveryIndex((idx) => (idx + 1) % 4)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  // Pill 2: Live fluctuating monitoring telemetry
  const [liveRps, setLiveRps] = React.useState(32450)
  const [liveP99, setLiveP99] = React.useState(58.0)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setLiveRps(Math.floor(32100 + Math.random() * 800))
      setLiveP99(Number((56.5 + Math.random() * 3.2).toFixed(1)))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Pill 3: Live fluctuating ramp step
  const [rampProgress, setRampProgress] = React.useState(34200)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setRampProgress(Math.floor(34000 + Math.random() * 400))
    }, 1400)
    return () => clearInterval(interval)
  }, [])

  const copyCommand = () => {
    navigator.clipboard.writeText(
      "curl -sSL https://strim.dev/install.sh | bash"
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section
      id="hero"
      className="relative isolate scroll-mt-20 overflow-hidden bg-background px-4 py-20 sm:px-6 lg:px-8"
    >
      {/* Live Infinitely Running Matrix Canvas */}
      <AsciiDataBackground />

      {/* Subtle radial backdrop accent */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="size-[580px] rounded-full bg-brand/5 blur-[140px]" />
        <div className="size-[380px] rounded-full bg-sand/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl text-center">
        {/* Display Headline */}
        <h1 className="mt-8 font-mono text-[clamp(2.4rem,5.6vw,3rem)] leading-[1.06] font-light text-foreground">
          Find your server&apos;s breaking point{" "}
          <br className="hidden sm:inline" />
          <span className="font-serif font-normal text-sand italic">
            before production does.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="sm:text-md mx-auto mt-6 max-w-2xl font-sans text-base leading-relaxed font-normal text-sand">
          Simulate real user traffic, uncover hidden bottlenecks, and find out
          exactly how many requests your server can handle before it slows down
          or crashes.
        </p>

        {/* Dual Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-brand px-7 py-3 font-mono text-xs font-medium tracking-[0.04em] text-white uppercase shadow-md shadow-brand/20 transition-all hover:bg-brand-hover"
          >
            <span>Start Load Test</span>
            <ArrowRight className="size-4" />
          </Link>

          <button
            onClick={copyCommand}
            className="inline-flex items-center justify-center gap-2.5 border border-border bg-surface-raised px-6 py-3 font-mono text-xs font-medium tracking-[0.04em] text-sand uppercase transition-colors hover:border-sand hover:bg-surface-hover"
          >
            {copied ? (
              <>
                <Check className="size-4 text-success" />
                <span className="text-success">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Terminal className="size-4 text-brand" />
                <span>Copy CLI Quickstart</span>
                <Copy className="size-3.5 text-foreground-subtle" />
              </>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE 3-PILL SWITCHER (Autoruns in infinite loop)                   */}
        {/* ========================================================================= */}
        <div className="mt-14 flex justify-center">
          <div
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface p-1.5 shadow-xl"
          >
            {/* Pill 1: Discovery */}
            <button
              type="button"
              onClick={() => setActivePill("discovery")}
              className={`relative flex items-center gap-2 overflow-hidden rounded px-4 py-2 font-mono text-xs transition-all ${
                activePill === "discovery"
                  ? "border border-border bg-surface-hover font-semibold text-foreground shadow-sm"
                  : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${activePill === "discovery" ? "animate-pulse bg-success" : "bg-transparent"}`}
              />
              <span>Automatic Discovery</span>
              {activePill === "discovery" && !isPaused && (
                <div className="absolute bottom-0 left-0 h-[2px] animate-[progress_5.5s_linear] bg-success/80" />
              )}
            </button>

            {/* Pill 2: Monitoring */}
            <button
              type="button"
              onClick={() => setActivePill("monitoring")}
              className={`relative flex items-center gap-2 overflow-hidden rounded px-4 py-2 font-mono text-xs transition-all ${
                activePill === "monitoring"
                  ? "border border-border bg-surface-hover font-semibold text-foreground shadow-sm"
                  : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${activePill === "monitoring" ? "animate-pulse bg-brand" : "bg-transparent"}`}
              />
              <span>Live Monitoring</span>
              {activePill === "monitoring" && !isPaused && (
                <div className="absolute bottom-0 left-0 h-[2px] animate-[progress_5.5s_linear] bg-brand/80" />
              )}
            </button>

            {/* Pill 3: Capacity */}
            <button
              type="button"
              onClick={() => setActivePill("capacity")}
              className={`relative flex items-center gap-2 overflow-hidden rounded px-4 py-2 font-mono text-xs transition-all ${
                activePill === "capacity"
                  ? "border border-border bg-surface-hover font-semibold text-foreground shadow-sm"
                  : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${activePill === "capacity" ? "animate-pulse bg-warning" : "bg-transparent"}`}
              />
              <span>Breaking Point Analysis</span>
              {activePill === "capacity" && !isPaused && (
                <div className="absolute bottom-0 left-0 h-[2px] animate-[progress_5.5s_linear] bg-warning/80" />
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE SHOWCASE CARD                                                 */}
        {/* ========================================================================= */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative mt-6 min-h-[440px] rounded-xl border border-border bg-surface p-6 text-left shadow-xl shadow-black sm:p-8 lg:p-10"
        >
          <CornerCrosshairs colorClass="text-sand/30" />

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 1: AUTOMATIC DISCOVERY                                              */}
          {/* ----------------------------------------------------------------------- */}
          {activePill === "discovery" && (
            <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
              {/* Left Column (5 cols) */}
              <div className="flex min-h-[320px] flex-col justify-between space-y-4 py-1 lg:col-span-5 lg:h-[355px]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-success">
                    <span className="size-1.5 animate-ping rounded-full bg-success" />
                    <span>STEP 1 · ENDPOINT CATALOGING</span>
                  </div>
                  <h3 className="font-mono text-2xl leading-snug font-normal tracking-tight text-foreground sm:text-3xl">
                    APIs mapped automatically from real traffic.
                  </h3>
                  <p className="font-sans text-sm leading-relaxed text-foreground-muted">
                    Stop documenting routes by hand. STRIM listens to incoming
                    traffic, automatically groups dynamic paths (like{" "}
                    <code className="rounded bg-surface-hover px-1 py-0.5 text-sand">
                      /orders/4921
                    </code>{" "}
                    into{" "}
                    <code className="rounded bg-surface-hover px-1 py-0.5 text-sand">
                      /orders/{"{id}"}
                    </code>
                    ), and validates parameters in real time.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Sub-Pills */}
                  <div className="flex flex-wrap gap-2 font-mono text-xs">
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Dynamic ID grouping
                    </span>
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      OpenAPI 3.x import
                    </span>
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Zero manual entry
                    </span>
                  </div>

                  <div>
                    <Link
                      href="#platform-architecture"
                      className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-success uppercase transition-colors hover:text-success"
                    >
                      <span>LEARN ABOUT API DISCOVERY</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right Column: Animated Interactive Console (7 cols) */}
              <div className="flex min-h-[350px] flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface-sunken lg:col-span-7 lg:h-[355px]">
                {/* Console Sub-Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      Live Route Scanner
                    </span>
                    <span className="text-foreground-subtle">·</span>
                    <span className="text-success">14 endpoints detected</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-success">
                    <span className="size-1.5 animate-pulse rounded-full bg-success" />
                    <span>sniffing live traffic</span>
                  </div>
                </div>

                {/* Console Body: Live Streaming Cards */}
                <div className="flex flex-1 flex-col justify-between p-4 font-mono text-xs text-sand">
                  <div className="flex justify-between text-[10px] tracking-wider text-foreground-subtle uppercase">
                    <span>INCOMING HTTP REQUEST</span>
                    <span>AUTOMATIC NORMALIZATION</span>
                  </div>

                  <div className="my-auto space-y-1.5">
                    {/* Item 1 */}
                    <div
                      className={`rounded border p-2 transition-all duration-300 ${discoveryIndex === 0 ? "border-success/60 bg-success-subtle/20 text-foreground shadow-xs" : "border-border-subtle bg-surface text-foreground-muted"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-brand">POST</span>
                          <span>/v1/orders/8921</span>
                        </div>
                        <span className="flex items-center gap-1 font-semibold text-success">
                          <Check className="size-3 text-success" />
                          <span>/v1/orders/{"{id}"}</span>
                        </span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-foreground-subtle">
                        <span>Pattern: UUID parameter grouped</span>
                        <span className="text-success">12.4ms · 200 OK</span>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div
                      className={`rounded border p-2 transition-all duration-300 ${discoveryIndex === 1 ? "border-success/60 bg-success-subtle/20 text-foreground shadow-xs" : "border-border-subtle bg-surface text-foreground-muted"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-success">GET</span>
                          <span>/v1/catalog/items/44</span>
                        </div>
                        <span className="flex items-center gap-1 font-semibold text-success">
                          <Check className="size-3 text-success" />
                          <span>/v1/catalog/items/{"{id}"}</span>
                        </span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-foreground-subtle">
                        <span>Pattern: Numeric ID grouped</span>
                        <span className="text-success">3.8ms · 200 OK</span>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div
                      className={`rounded border p-2 transition-all duration-300 ${discoveryIndex === 2 ? "border-success/60 bg-success-subtle/20 text-foreground shadow-xs" : "border-border-subtle bg-surface text-foreground-muted"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-brand">POST</span>
                          <span>/v1/checkout/session</span>
                        </div>
                        <span className="flex items-center gap-1 font-semibold text-success">
                          <Check className="size-3 text-success" />
                          <span>/v1/checkout/session</span>
                        </span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-foreground-subtle">
                        <span>Pattern: Exact route verified</span>
                        <span className="text-success">18.2ms · 200 OK</span>
                      </div>
                    </div>

                    {/* Item 4 */}
                    <div
                      className={`rounded border p-2 transition-all duration-300 ${discoveryIndex === 3 ? "border-success/60 bg-success-subtle/20 text-foreground shadow-xs" : "border-border-subtle bg-surface text-foreground-muted"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-warning">DELETE</span>
                          <span>/v1/cart/items/9012</span>
                        </div>
                        <span className="flex items-center gap-1 font-semibold text-success">
                          <Check className="size-3 text-success" />
                          <span>/v1/cart/items/{"{id}"}</span>
                        </span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-foreground-subtle">
                        <span>Pattern: Resource ID parsed</span>
                        <span className="text-success">7.2ms · 204 OK</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between border-t border-border-subtle pt-2 text-[11px] text-foreground-subtle">
                    <span>Catalog Status: 100% synchronized</span>
                    <span className="text-success">
                      0 manual entry required
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 2: LIVE MONITORING                                                  */}
          {/* ----------------------------------------------------------------------- */}
          {activePill === "monitoring" && (
            <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
              {/* Left Column (5 cols) */}
              <div className="flex min-h-[320px] flex-col justify-between space-y-4 py-1 lg:col-span-5 lg:h-[355px]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-brand">
                    <span className="size-1.5 animate-ping rounded-full bg-brand" />
                    <span>STEP 2 · REAL-TIME TELEMETRY</span>
                  </div>
                  <h3 className="font-mono text-2xl leading-snug font-normal tracking-tight text-foreground sm:text-3xl">
                    Watch response times live with zero polling lag.
                  </h3>
                  <p className="font-sans text-sm leading-relaxed text-foreground-muted">
                    Direct stream of your server&apos;s true speed. Track
                    request throughput, error rates, and separate connection
                    setup from backend processing times without setting up
                    complex monitoring infrastructure.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Sub-Pills */}
                  <div className="flex flex-wrap gap-2 font-mono text-xs">
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Sub-second live stream
                    </span>
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Real P50, P95, P99
                    </span>
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Zero fake zeros
                    </span>
                  </div>

                  <div>
                    <Link
                      href="#simulator"
                      className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-brand uppercase transition-colors hover:text-brand-hover"
                    >
                      <span>EXPLORE REAL-TIME MONITORING</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right Column: Animated Monitoring Console (7 cols) */}
              <div className="flex min-h-[350px] flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface-sunken lg:col-span-7 lg:h-[355px]">
                {/* Console Sub-Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      Live Cockpit
                    </span>
                    <span className="text-foreground-subtle">·</span>
                    <span className="font-semibold text-brand">
                      {liveRps.toLocaleString()} req/s
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-success">
                    <span className="size-1.5 animate-pulse rounded-full bg-success" />
                    <span>SSE 1s resolution</span>
                  </div>
                </div>

                {/* Console Body */}
                <div className="flex flex-1 flex-col justify-between p-4 font-mono text-xs text-sand">
                  {/* Latency Percentile Bars */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-[10px] tracking-wider text-foreground-subtle uppercase">
                      <span>RESPONSE TIME DISTRIBUTION</span>
                      <span className="text-success">SLA: 99.8% Healthy</span>
                    </div>

                    <div className="space-y-2">
                      {/* P50 */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="w-24 text-foreground-muted">
                          Median (P50)
                        </span>
                        <div className="mx-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                          <div className="h-full w-[24%] rounded-full bg-success transition-all duration-500" />
                        </div>
                        <span className="w-14 text-right font-semibold text-foreground">
                          12.4ms
                        </span>
                      </div>

                      {/* P95 */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="w-24 text-foreground-muted">
                          95th %ile
                        </span>
                        <div className="mx-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                          <div className="h-full w-[42%] rounded-full bg-brand transition-all duration-500" />
                        </div>
                        <span className="w-14 text-right font-semibold text-foreground">
                          28.1ms
                        </span>
                      </div>

                      {/* P99 */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="w-24 text-foreground-muted">
                          99th %ile
                        </span>
                        <div className="mx-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                          <div
                            className="h-full rounded-full bg-warning transition-all duration-500"
                            style={{
                              width: `${Math.min(100, (liveP99 / 90) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-14 text-right font-semibold text-warning">
                          {liveP99}ms
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Breakdown Mini-Cards */}
                  <div className="my-auto grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between rounded border border-border bg-surface-raised p-2">
                      <span className="text-foreground-muted">
                        Network Handshake
                      </span>
                      <span className="font-mono text-foreground">2.1ms</span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-border bg-surface-raised p-2">
                      <span className="text-foreground-muted">
                        Server Execution
                      </span>
                      <span className="font-mono text-success">10.3ms</span>
                    </div>
                  </div>

                  {/* Status Breakdown Bar */}
                  <div className="flex shrink-0 items-center justify-between border-t border-border-subtle pt-2 text-[11px]">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-success">
                        99.8% 200 OK
                      </span>
                      <span className="text-warning">0.2% 429 LIMITED</span>
                      <span className="text-foreground-subtle">
                        0.0% 500 ERR
                      </span>
                    </div>
                    <span className="font-mono text-success">0 fake zeros</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* TAB 3: BREAKING POINT ANALYSIS                                          */}
          {/* ----------------------------------------------------------------------- */}
          {activePill === "capacity" && (
            <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
              {/* Left Column (5 cols) */}
              <div className="flex min-h-[320px] flex-col justify-between space-y-4 py-1 lg:col-span-5 lg:h-[355px]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-warning">
                    <span className="size-1.5 animate-ping rounded-full bg-warning" />
                    <span>STEP 3 · CAPACITY DIAGNOSIS</span>
                  </div>
                  <h3 className="font-mono text-2xl leading-snug font-normal tracking-tight text-foreground sm:text-3xl">
                    Find your API&apos;s breaking point before production does.
                  </h3>
                  <p className="font-sans text-sm leading-relaxed text-foreground-muted">
                    Simulate heavy traffic to discover where your server slows
                    down. The moment response times spike, STRIM automatically
                    isolates the bottleneck and outputs your safe capacity
                    limit.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Sub-Pills */}
                  <div className="flex flex-wrap gap-2 font-mono text-xs">
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Saturation knee detection
                    </span>
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Root cause diagnosis
                    </span>
                    <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
                      Safe production ceiling
                    </span>
                  </div>

                  <div>
                    <Link
                      href="#workbench"
                      className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-warning uppercase transition-colors hover:text-warning"
                    >
                      <span>EXPLORE CAPACITY ANALYSIS</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right Column: Self-Contained SVG Load Curve (7 cols) */}
              <div className="flex min-h-[350px] flex-col justify-between overflow-hidden rounded-lg border border-border bg-surface-sunken lg:col-span-7 lg:h-[355px]">
                {/* Console Sub-Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      Saturation Ramp Test
                    </span>
                    <span className="text-foreground-subtle">·</span>
                    <span className="font-semibold text-warning">
                      {rampProgress.toLocaleString()} req/s
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-danger">
                    <span className="size-1.5 animate-pulse rounded-full bg-danger" />
                    <span>Knee Detected</span>
                  </div>
                </div>

                {/* Console Body */}
                <div className="flex flex-1 flex-col justify-between p-4 font-mono text-xs text-sand">
                  <div className="flex justify-between text-[10px] text-foreground-subtle">
                    <span>RESPONSE TIME VS TRAFFIC RAMP</span>
                    <span className="font-semibold text-danger">
                      Latency Spike: +2,100%
                    </span>
                  </div>

                  {/* Bounded, Balanced SVG Load Curve */}
                  <div className="relative my-auto h-28 w-full overflow-hidden rounded border border-border-subtle bg-background px-2 py-1">
                    <svg
                      className="h-full w-full"
                      viewBox="0 0 360 85"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient
                          id="saturationGrad"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--brand)"
                            stopOpacity="0.1"
                          />
                          <stop
                            offset="65%"
                            stopColor="var(--brand)"
                            stopOpacity="0.25"
                          />
                          <stop
                            offset="85%"
                            stopColor="var(--danger)"
                            stopOpacity="0.35"
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--danger)"
                            stopOpacity="0.45"
                          />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line
                        x1="15"
                        y1="70"
                        x2="345"
                        y2="70"
                        stroke="var(--border-subtle)"
                        strokeWidth="1"
                      />
                      <line
                        x1="15"
                        y1="45"
                        x2="345"
                        y2="45"
                        stroke="var(--border-subtle)"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <line
                        x1="15"
                        y1="18"
                        x2="345"
                        y2="18"
                        stroke="var(--border-subtle)"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />

                      {/* 100ms SLA Limit line */}
                      <line
                        x1="15"
                        y1="46"
                        x2="345"
                        y2="46"
                        stroke="var(--warning)"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                        opacity="0.5"
                      />
                      <text
                        x="20"
                        y="42"
                        fill="var(--warning)"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        100ms SLA Threshold
                      </text>

                      {/* Fill area under curve */}
                      <path
                        d="M 15,67 Q 150,67 230,64 T 285,55 T 325,18 L 325,70 L 15,70 Z"
                        fill="url(#saturationGrad)"
                      />

                      {/* Main Blue Load Curve (Normal Range) */}
                      <path
                        d="M 15,67 Q 150,67 230,64 T 285,55"
                        fill="none"
                        stroke="var(--brand)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* Exponential Spike Curve in Red */}
                      <path
                        d="M 285,55 T 325,18"
                        fill="none"
                        stroke="var(--danger)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* Vertical Inflection Marker Line */}
                      <line
                        x1="285"
                        y1="12"
                        x2="285"
                        y2="70"
                        stroke="var(--danger)"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        opacity="0.75"
                      />

                      {/* Inflection callout box */}
                      <rect
                        x="238"
                        y="10"
                        width="92"
                        height="15"
                        rx="3"
                        fill="var(--danger-subtle)"
                        stroke="var(--danger)"
                        strokeWidth="0.8"
                      />
                      <text
                        x="284"
                        y="21"
                        fill="var(--danger)"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        34,200 req/s
                      </text>

                      {/* Contained Pulsing Red Dot (SVG Native animation) */}
                      <circle cx="285" cy="55" r="4" fill="var(--danger)">
                        <animate
                          attributeName="r"
                          values="3.5;7;3.5"
                          dur="1.8s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.9;0.15;0.9"
                          dur="1.8s"
                          repeatCount="indefinite"
                        />
                      </circle>
                      <circle
                        cx="285"
                        cy="55"
                        r="3.5"
                        fill="var(--danger)"
                        stroke="var(--background)"
                        strokeWidth="1"
                      />

                      {/* X-axis labels */}
                      <text
                        x="18"
                        y="80"
                        fill="var(--foreground-subtle)"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        0k
                      </text>
                      <text
                        x="110"
                        y="80"
                        fill="var(--foreground-subtle)"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        15k
                      </text>
                      <text
                        x="210"
                        y="80"
                        fill="var(--foreground-subtle)"
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        28k
                      </text>
                      <text
                        x="285"
                        y="80"
                        fill="var(--danger)"
                        fontSize="7.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        34.2k
                      </text>
                      <text
                        x="340"
                        y="80"
                        fill="var(--foreground-subtle)"
                        fontSize="7.5"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        40k req/s
                      </text>
                    </svg>
                  </div>

                  {/* Diagnosis Report Grid */}
                  <div className="my-auto grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-0.5 rounded border border-border bg-surface-raised p-2">
                      <div className="flex items-center justify-between text-[10px] text-foreground-subtle">
                        <span>BOTTLENECK</span>
                        <span className="py-0.2 rounded border border-danger/30 bg-danger-subtle/40 px-1 font-semibold text-danger">
                          EXHAUSTED
                        </span>
                      </div>
                      <div className="truncate text-[11px] font-semibold text-foreground">
                        Postgres Pool (100% full)
                      </div>
                      <div className="text-[10px] text-foreground-muted">
                        Queuing delay: +410ms
                      </div>
                    </div>

                    <div className="space-y-0.5 rounded border border-border bg-surface-raised p-2">
                      <div className="flex items-center justify-between text-[10px] text-foreground-subtle">
                        <span>SAFE CEILING</span>
                        <span className="py-0.2 rounded border border-success/30 bg-success-subtle/40 px-1 font-semibold text-success">
                          STABLE
                        </span>
                      </div>
                      <div className="truncate text-[11px] font-bold text-success">
                        31,500 requests/sec
                      </div>
                      <div className="text-[10px] text-foreground-muted">
                        P99 &lt; 28ms guaranteed
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis Report Footer */}
                  <div className="flex shrink-0 items-center justify-between border-t border-border-subtle pt-2 text-[11px] text-foreground-subtle">
                    <div className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-warning" />
                      <span>Ramp complete: 0 → 40k req/s</span>
                    </div>
                    <span className="font-mono text-warning">
                      1 root cause isolated
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
