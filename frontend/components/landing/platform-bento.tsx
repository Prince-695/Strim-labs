"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Check, Terminal, Activity, Zap, Cpu, Radio, ShieldCheck, ChevronRight, Layers, Play, Pause, Server, BarChart3, Clock, AlertTriangle } from "lucide-react"

// Card 01: Ingestion stream mock pool
const STREAM_POOL = [
  { method: "POST", path: "/v1/orders/8921", normalized: "/v1/orders/{id}", status: "200", ms: "12.4ms", type: "UUID grouped" },
  { method: "GET", path: "/v1/catalog/items/44", normalized: "/v1/catalog/items/{id}", status: "200", ms: "3.8ms", type: "Numeric ID grouped" },
  { method: "POST", path: "/v1/checkout/session", normalized: "/v1/checkout/session", status: "200", ms: "18.2ms", type: "Exact route verified" },
  { method: "DELETE", path: "/v1/cart/items/9012", normalized: "/v1/cart/items/{id}", status: "204", ms: "7.2ms", type: "Resource ID parsed" },
  { method: "POST", path: "/v1/auth/tokens", normalized: "/v1/auth/tokens", status: "200", ms: "14.1ms", type: "Exact route verified" },
  { method: "GET", path: "/v1/orders/search?q=shoes", normalized: "/v1/orders/search", status: "200", ms: "8.6ms", type: "Query params stripped" },
  { method: "PUT", path: "/v1/users/profile/77", normalized: "/v1/users/profile/{id}", status: "200", ms: "16.4ms", type: "Entity param grouped" },
]

export function PlatformBento() {
  // ---------------------------------------------------------------------------
  // CARD 01: Live Ingestion Stream & Route Catalog Auto-Increment
  // ---------------------------------------------------------------------------
  const [streamOffset, setStreamOffset] = React.useState(0)
  const [catalogCounts, setCatalogCounts] = React.useState({
    orders: 142850,
    catalog: 298110,
    auth: 88400,
    checkout: 12490,
  })

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStreamOffset((prev) => (prev + 1) % STREAM_POOL.length)
      setCatalogCounts((prev) => ({
        ...prev,
        orders: prev.orders + Math.floor(1 + Math.random() * 4),
        catalog: prev.catalog + Math.floor(2 + Math.random() * 6),
        checkout: prev.checkout + (Math.random() > 0.6 ? 1 : 0),
      }))
    }, 1600)
    return () => clearInterval(interval)
  }, [])

  // Build a 4-item rolling slice from the pool
  const currentStreamSlice = React.useMemo(() => {
    const items = []
    for (let i = 0; i < 4; i++) {
      items.push(STREAM_POOL[(streamOffset + i) % STREAM_POOL.length])
    }
    return items
  }, [streamOffset])

  // ---------------------------------------------------------------------------
  // CARD 02: Faceted Breakdown Switcher (By Status, By Latency Tier, By Network Phase)
  // ---------------------------------------------------------------------------
  type FacetKey = "status" | "tier" | "phase"
  const [activeFacet, setActiveFacet] = React.useState<FacetKey>("status")

  // ---------------------------------------------------------------------------
  // CARD 03: Spec In -> Verification Pulse Indicator
  // ---------------------------------------------------------------------------
  const [verifyPulse, setVerifyPulse] = React.useState(0)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setVerifyPulse((p) => (p + 1) % 3)
    }, 1900)
    return () => clearInterval(interval)
  }, [])

  // ---------------------------------------------------------------------------
  // CARD 04: Load Engine Live Virtual Users & Telemetry
  // ---------------------------------------------------------------------------
  const [engineUsers, setEngineUsers] = React.useState(48200)
  const [engineRps, setEngineRps] = React.useState(34200)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setEngineUsers(Math.floor(48000 + Math.random() * 600))
      setEngineRps(Math.floor(34000 + Math.random() * 500))
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  // ---------------------------------------------------------------------------
  // CARD 05: Interactive Breaking Point Diagnosis Steps (1, 2, 3)
  // ---------------------------------------------------------------------------
  const [diagStep, setDiagStep] = React.useState<1 | 2 | 3>(1)
  const [diagPaused, setDiagPaused] = React.useState(false)

  React.useEffect(() => {
    if (diagPaused) return
    const interval = setInterval(() => {
      setDiagStep((prev) => (prev === 3 ? 1 : ((prev + 1) as 1 | 2 | 3)))
    }, 4500)
    return () => clearInterval(interval)
  }, [diagPaused])

  return (
    <section id="architecture" className="scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8 relative">
      <div id="platform-architecture" className="absolute -top-24 pointer-events-none" />
      <div className="mx-auto max-w-7xl">
        {/* Section Tag & Headline */}
        <div className="flex flex-col items-start gap-3 mb-10">
          <div className="flex items-center gap-2 font-mono text-xs text-brand uppercase tracking-wider">
            <span>[03]</span>
            <span>HOW STRIM LABS WORKS</span>
          </div>
          <h2 className="font-mono text-2xl sm:text-3xl font-normal text-foreground tracking-[-0.03em] max-w-full">
            Everything you need to test, monitor, and scale your APIs.
          </h2>
          <p className="font-sans text-base text-sand leading-relaxed mt-2">
            Most teams only discover their server&apos;s limits during an outage. STRIM Labs automatically maps your endpoints, simulates realistic user traffic, and pinpoints exactly where your system slows down—so you can fix bottlenecks with confidence.
          </p>
        </div>

        {/* 4 Stat Columns (RushDB Style) */}
        <div className="rounded-xl border border-border bg-surface-raised p-6 sm:p-8 mb-12">
          <div className="font-mono text-xs text-foreground-muted uppercase tracking-wider mb-6">
            Engineered for high performance · Zero setup required
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <div className="font-mono text-4xl font-normal text-brand tracking-tight">
                500k<span className="text-2xl text-brand/70">+</span>
              </div>
              <div className="font-mono text-xs sm:text-sm text-foreground mt-2 font-semibold">
                simultaneous users
              </div>
              <div className="font-sans text-xs text-foreground-subtle mt-1 leading-relaxed">
                Simulate massive traffic without crashing your laptop or dropping calls
              </div>
            </div>

            <div>
              <div className="font-mono text-4xl font-normal text-success tracking-tight">0</div>
              <div className="font-mono text-xs sm:text-sm text-foreground mt-2 font-semibold">
                fake zeros or guesses
              </div>
              <div className="font-sans text-xs text-foreground-subtle mt-1 leading-relaxed">
                Real, unmasked response times for every single request
              </div>
            </div>

            <div>
              <div className="font-mono text-4xl font-normal text-brand tracking-tight">
                100<span className="text-2xl text-sand font-normal">%</span>
              </div>
              <div className="font-mono text-xs sm:text-sm text-foreground mt-2 font-semibold">
                timing accuracy
              </div>
              <div className="font-sans text-xs text-foreground-subtle mt-1 leading-relaxed">
                Test runner operates with zero internal lag skewing your metrics
              </div>
            </div>

            <div>
              <div className="font-mono text-4xl font-normal text-success tracking-tight">
                &lt;1<span className="text-2xl text-sand font-normal">s</span>
              </div>
              <div className="font-mono text-xs sm:text-sm text-foreground mt-2 font-semibold">
                live dashboard updates
              </div>
              <div className="font-sans text-xs text-foreground-subtle mt-1 leading-relaxed">
                Watch response times and error rates update live on your screen
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2x2 Bento Grid (RushDB Style with hairline interior borders)          */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* ========================================================= */}
          {/* CARD 01: Ingestion & Live Endpoint Discovery              */}
          {/* ========================================================= */}
          <div className="rounded-xl border border-border bg-surface-raised overflow-hidden flex flex-col justify-between group hover:border-border transition-all">
            {/* Visualizer Header */}
            <div className="bg-surface-sunken p-5 sm:p-6 border-b border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-[11px] leading-relaxed">
                {/* Left: Live Request Stream with moving indicator */}
                <div>
                  <div className="text-foreground-subtle uppercase tracking-wider mb-2 text-[10px] flex items-center justify-between">
                    <span>incoming requests</span>
                    <span className="flex items-center gap-1 text-success text-[9.5px]">
                      <span className="size-1 rounded-full bg-success animate-pulse" />
                      sniffing
                    </span>
                  </div>
                  <div className="space-y-1.5 text-foreground-muted">
                    {currentStreamSlice.map((item, idx) => {
                      const isLatest = idx === 0
                      return (
                        <div
                          key={`${item.path}-${idx}`}
                          className={`flex items-center justify-between p-1.5 rounded transition-all duration-300 ${
                            isLatest
                              ? "bg-surface-hover text-foreground border border-success/40 shadow-xs"
                              : "text-foreground-muted bg-background/60"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                            <span
                              className={`font-bold text-[10px] ${
                                item.method === "POST"
                                  ? "text-brand"
                                  : item.method === "GET"
                                  ? "text-success"
                                  : "text-warning"
                              }`}
                            >
                              {item.method}
                            </span>
                            <span className="truncate text-[10.5px]">{item.path}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                            <span className={item.status === "200" || item.status === "204" ? "text-success" : "text-danger"}>
                              {item.status}
                            </span>
                            <span className="text-foreground-subtle">{item.ms}</span>
                            {isLatest && <span className="text-success animate-pulse">●─→</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right: Dynamic Route Catalog with live auto-incrementing counters */}
                <div className="border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-5">
                  <div className="text-foreground-subtle uppercase tracking-wider mb-2 text-[10px] flex items-center justify-between">
                    <span>catalog · ENDPOINTS</span>
                    <span className="text-success">SYNCED</span>
                  </div>
                  <div className="space-y-1.5 text-[10.5px]">
                    <div className="flex justify-between text-foreground-subtle border-b border-border pb-1 text-[9.5px]">
                      <span>endpoint</span>
                      <span>latency</span>
                      <span>calls</span>
                    </div>

                    <div className="flex justify-between items-center text-foreground py-0.5">
                      <span className="truncate max-w-[105px] text-brand">POST /orders</span>
                      <span className="text-sand">18ms</span>
                      <span className="text-foreground-muted font-mono tabular-nums">
                        {catalogCounts.orders.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-foreground py-0.5">
                      <span className="truncate max-w-[105px] text-success">GET /catalog</span>
                      <span className="text-sand">4ms</span>
                      <span className="text-foreground-muted font-mono tabular-nums">
                        {catalogCounts.catalog.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-foreground py-0.5">
                      <span className="truncate max-w-[105px] text-brand">POST /auth</span>
                      <span className="text-sand">24ms</span>
                      <span className="text-foreground-muted font-mono tabular-nums">
                        {catalogCounts.auth.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-danger bg-danger-subtle px-1.5 py-0.5 rounded border border-danger/30">
                      <span className="truncate max-w-[105px] font-semibold">POST /checkout</span>
                      <span className="font-bold">412ms</span>
                      <span className="font-mono tabular-nums">
                        {catalogCounts.checkout.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border text-[9.5px] text-foreground-subtle flex items-center justify-between">
                    <span>Pattern: dynamic IDs normalized</span>
                    <span className="text-success">0 config</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="font-mono text-xs font-semibold text-brand mb-2">01</div>
              <h3 className="font-mono text-xl sm:text-2xl font-normal text-foreground tracking-tight">
                Automatic API discovery on every request.
              </h3>
              <p className="font-sans text-sm text-foreground-muted mt-3 leading-relaxed">
                No manual route typing or configuration. STRIM automatically detects your API endpoints from real traffic, groups dynamic URLs (like <code className="text-sand bg-surface-hover px-1 py-0.5 rounded">/orders/4921</code> into <code className="text-sand bg-surface-hover px-1 py-0.5 rounded">/orders/{'{id}'}</code>), and tracks latency trends in real time.
              </p>
              <div className="mt-5">
                <Link
                  href="#workbench"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-brand hover:text-brand-hover uppercase tracking-wider transition-colors"
                >
                  <span>HOW DISCOVERY WORKS</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 02: True Response Times (Interactive Faceted Bar)     */}
          {/* ========================================================= */}
          <div className="rounded-xl border border-border bg-surface-raised overflow-hidden flex flex-col justify-between group hover:border-border transition-all">
            {/* Visualizer Header: Interactive Facet Switcher like RushDB */}
            <div className="bg-surface-sunken p-5 sm:p-6 border-b border-border">
              <div className="font-mono text-[11px] leading-relaxed">
                <div className="flex items-center justify-between text-foreground-subtle uppercase tracking-wider text-[10px] mb-2">
                  <span>target · CHECKOUT_SERVICE</span>
                  <span className="text-success">100% UNMASKED</span>
                </div>

                {/* Interactive Facet Pill Switcher */}
                <div className="flex items-center gap-1.5 mb-3.5 pb-2.5 border-b border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setActiveFacet("status")}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                      activeFacet === "status"
                        ? "bg-surface-hover text-foreground border border-border font-semibold"
                        : "text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    By Status Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFacet("tier")}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                      activeFacet === "tier"
                        ? "bg-surface-hover text-foreground border border-border font-semibold"
                        : "text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    By Latency Tier
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFacet("phase")}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                      activeFacet === "phase"
                        ? "bg-surface-hover text-foreground border border-border font-semibold"
                        : "text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    By Network Phase
                  </button>
                </div>

                {/* Dynamic Faceted Content */}
                {activeFacet === "status" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-success shrink-0 font-medium">200 OK</span>
                      <span className="text-success font-mono tracking-tighter truncate px-2 select-none">
                        ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
                      </span>
                      <span className="text-foreground shrink-0 font-mono text-[11px] tabular-nums">142,920</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-warning shrink-0 font-medium">429 LIMITED</span>
                      <span className="text-warning font-mono tracking-tighter truncate px-2 select-none">
                        ■■■
                      </span>
                      <span className="text-foreground-muted shrink-0 font-mono text-[11px] tabular-nums">1,840</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-danger shrink-0 font-medium">504 TIMEOUT</span>
                      <span className="text-danger font-mono tracking-tighter truncate px-2 select-none">
                        ■
                      </span>
                      <span className="text-foreground-muted shrink-0 font-mono text-[11px] tabular-nums">412</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-foreground-subtle shrink-0 font-medium">500 ERR</span>
                      <span className="text-foreground-subtle font-mono tracking-tighter truncate px-2 select-none">
                        ▫
                      </span>
                      <span className="text-foreground-subtle shrink-0 font-mono text-[11px] tabular-nums">28</span>
                    </div>
                  </div>
                )}

                {activeFacet === "tier" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-success shrink-0 font-medium">&lt; 10ms Fast</span>
                      <span className="text-success font-mono tracking-tighter truncate px-2 select-none">
                        ■■■■■■■■■■■■■■■■■■■■■■■■
                      </span>
                      <span className="text-foreground shrink-0 font-mono text-[11px] tabular-nums">118,400</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-brand shrink-0 font-medium">10-50ms Norm</span>
                      <span className="text-brand font-mono tracking-tighter truncate px-2 select-none">
                        ■■■■■■■
                      </span>
                      <span className="text-foreground-muted shrink-0 font-mono text-[11px] tabular-nums">24,120</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-warning shrink-0 font-medium">50-200ms Slow</span>
                      <span className="text-warning font-mono tracking-tighter truncate px-2 select-none">
                        ■
                      </span>
                      <span className="text-foreground-muted shrink-0 font-mono text-[11px] tabular-nums">2,268</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-danger shrink-0 font-medium">&gt; 200ms Spike</span>
                      <span className="text-danger font-mono tracking-tighter truncate px-2 select-none">
                        ▫
                      </span>
                      <span className="text-danger shrink-0 font-mono text-[11px] tabular-nums">412</span>
                    </div>
                  </div>
                )}

                {activeFacet === "phase" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-foreground-muted shrink-0 font-medium">DNS Lookup</span>
                      <span className="text-foreground-subtle font-mono tracking-tighter truncate px-2 select-none">
                        ■
                      </span>
                      <span className="text-foreground shrink-0 font-mono text-[11px]">0.8ms</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-foreground-muted shrink-0 font-medium">TCP + TLS</span>
                      <span className="text-brand font-mono tracking-tighter truncate px-2 select-none">
                        ■■
                      </span>
                      <span className="text-foreground shrink-0 font-mono text-[11px]">2.4ms</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-success shrink-0 font-medium">Server TTFB</span>
                      <span className="text-success font-mono tracking-tighter truncate px-2 select-none">
                        ■■■■■■■■■■■■■■■■■■■■
                      </span>
                      <span className="text-success shrink-0 font-mono text-[11px]">12.1ms</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 text-foreground-muted shrink-0 font-medium">Transfer</span>
                      <span className="text-foreground-subtle font-mono tracking-tighter truncate px-2 select-none">
                        ■■
                      </span>
                      <span className="text-foreground shrink-0 font-mono text-[11px]">1.8ms</span>
                    </div>
                  </div>
                )}

                <div className="mt-3.5 pt-2.5 border-t border-border-subtle flex items-center justify-between text-[10px] text-foreground-subtle">
                  <span>total requests: 145,200</span>
                  <span className="text-success">Zero fake zeros</span>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="font-mono text-xs font-semibold text-success mb-2">02</div>
              <h3 className="font-mono text-xl sm:text-2xl font-normal text-foreground tracking-tight">
                True response times. No hidden delays.
              </h3>
              <p className="font-sans text-sm text-foreground-muted mt-3 leading-relaxed">
                See exactly where time is spent on every request. STRIM separates connection setup, server processing, and network transfer so you know immediately whether delays come from your code, third-party APIs, or your database.
              </p>
              <div className="mt-5">
                <Link
                  href="#benchmarks"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-success hover:text-success uppercase tracking-wider transition-colors"
                >
                  <span>SEE LATENCY METRICS</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row of 2x2 Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* ========================================================= */}
          {/* CARD 03: Spec In, Verified Execution Tree Out             */}
          {/* ========================================================= */}
          <div className="rounded-xl border border-border bg-surface-raised overflow-hidden flex flex-col justify-between group hover:border-border transition-all">
            {/* Visualizer Header */}
            <div className="bg-surface-sunken p-5 sm:p-6 border-b border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 font-mono text-[11px] leading-relaxed">
                {/* Left: Target Config / OpenAPI Payload */}
                <div>
                  <div className="text-foreground-subtle uppercase tracking-wider mb-2 text-[10px] flex items-center justify-between">
                    <span>one spec</span>
                    <span className="text-brand text-[9.5px]">OpenAPI 3.x</span>
                  </div>
                  <div className="text-foreground-muted text-[10.5px] font-mono bg-surface p-2.5 rounded border border-border relative overflow-hidden">
                    <div><span className="text-sand">&#123;</span></div>
                    <div className="pl-3"><span className="text-brand">&quot;service&quot;</span>: <span className="text-success">&quot;checkout-api&quot;</span>,</div>
                    <div className="pl-3"><span className="text-brand">&quot;url&quot;</span>: <span className="text-sand">&quot;https://api.myapp.com&quot;</span>,</div>
                    <div className="pl-3"><span className="text-brand">&quot;routes&quot;</span>: [</div>
                    <div className="pl-6"><span className="text-foreground-muted">&#123; &quot;path&quot;: &quot;/v1/orders&quot; &#125;,</span></div>
                    <div className="pl-6"><span className="text-foreground-muted">&#123; &quot;path&quot;: &quot;/v1/checkout&quot; &#125;</span></div>
                    <div className="pl-3">]</div>
                    <div><span className="text-sand">&#125;</span></div>

                    {/* Subtle scanning pulse beam */}
                    <div className="absolute inset-x-0 h-[1.5px] bg-brand/40 animate-[marquee-horizontal_3s_ease-in-out_infinite]" />
                  </div>
                </div>

                {/* Right: Linked Route Hierarchy Tree (RushDB Style) */}
                <div className="border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-5">
                  <div className="text-foreground-subtle uppercase tracking-wider mb-2 text-[10px] flex items-center justify-between">
                    <span>linked endpoints</span>
                    <span className="text-success text-[9.5px] flex items-center gap-1">
                      <span className="size-1 rounded-full bg-success animate-pulse" />
                      READY
                    </span>
                  </div>
                  <div className="text-[10.5px] font-mono text-sand space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <span className="size-1.5 rounded-full bg-success" />
                      <span>checkout-api</span>
                      <span className="text-[9px] text-success/80 font-normal border border-success/30 bg-success-subtle/40 px-1 rounded">
                        VERIFIED
                      </span>
                    </div>
                    <div className="pl-3 text-foreground-muted">
                      <div>
                        ├── <span className="text-brand">orders</span> (POST)
                      </div>
                      <div className="pl-4 text-foreground-subtle">
                        ├── Safe ceiling: <span className="text-success">10k req/s</span>
                      </div>
                      <div className="pl-4 text-foreground-subtle">
                        └── Timeout: <span className="text-sand">500ms</span>
                      </div>
                    </div>
                    <div className="pl-3 text-foreground-muted">
                      <div>
                        └── <span className="text-brand">checkout</span> (POST)
                      </div>
                      <div className="pl-4 text-foreground-subtle">
                        └── Health check: <span className="text-success">Passing</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border text-[9.5px] text-foreground-subtle flex items-center justify-between">
                    <span>sha256: 9b4f2c...</span>
                    <span className="text-success">Ready to test</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="font-mono text-xs font-semibold text-brand mb-2">03</div>
              <h3 className="font-mono text-xl sm:text-2xl font-normal text-foreground tracking-tight">
                Import your API or let STRIM scan automatically.
              </h3>
              <p className="font-sans text-sm text-foreground-muted mt-3 leading-relaxed">
                Connect your server in seconds: upload your API documentation or let our lightweight GitHub Action scan your repository. STRIM verifies server ownership safely and prepares your routes for testing immediately.
              </p>
              <div className="mt-5">
                <Link
                  href="#methodology"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-brand hover:text-brand-hover uppercase tracking-wider transition-colors"
                >
                  <span>SEE SETUP PROCESS</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD 04: High-Capacity Load Engine with Real-Time Telemetry*/}
          {/* ========================================================= */}
          <div className="rounded-xl border border-border bg-surface-raised overflow-hidden flex flex-col justify-between group hover:border-border transition-all">
            {/* Visualizer Header */}
            <div className="bg-surface-sunken p-5 sm:p-6 border-b border-border">
              <div className="relative flex items-center justify-between font-mono text-[11px]">
                {/* Left Side: Pipeline Inputs */}
                <div className="space-y-2.5 z-10">
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="text-brand font-bold">&#123; &#125;</span>
                    <span className="text-[11px]">distributed runners</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="text-success font-bold">~</span>
                    <span className="text-[11px]">live traffic feed</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="text-warning font-bold">⏱</span>
                    <span className="text-[11px]">microsecond accuracy</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="text-brand font-bold">⚡</span>
                    <span className="text-[11px]">real-time updates</span>
                  </div>
                </div>

                {/* Center SVG Circuit Wire with Traveling Signal Pulses */}
                <div className="absolute inset-x-24 inset-y-0 flex items-center justify-center pointer-events-none">
                  <svg className="w-full h-28" viewBox="0 0 160 100" fill="none">
                    {/* Circuit lines */}
                    <path d="M 0,20 L 50,20 L 70,50 L 160,50" stroke="var(--border-subtle)" strokeWidth="1.5" />
                    <path d="M 0,40 L 40,40 L 65,50 L 160,50" stroke="var(--border-subtle)" strokeWidth="1.5" />
                    <path d="M 0,60 L 40,60 L 65,50 L 160,50" stroke="var(--border-subtle)" strokeWidth="1.5" />
                    <path d="M 0,80 L 50,80 L 70,50 L 160,50" stroke="var(--border-subtle)" strokeWidth="1.5" />

                    {/* Animated moving pulses */}
                    <circle r="3" fill="var(--brand)">
                      <animateMotion dur="2.4s" repeatCount="indefinite" path="M 0,20 L 50,20 L 70,50 L 160,50" />
                    </circle>
                    <circle r="3" fill="var(--success)">
                      <animateMotion dur="2s" repeatCount="indefinite" path="M 0,40 L 40,40 L 65,50 L 160,50" />
                    </circle>
                    <circle r="3" fill="var(--warning)">
                      <animateMotion dur="2.8s" repeatCount="indefinite" path="M 0,60 L 40,60 L 65,50 L 160,50" />
                    </circle>
                    <circle r="3" fill="var(--brand)">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path="M 0,80 L 50,80 L 70,50 L 160,50" />
                    </circle>
                  </svg>
                </div>

                {/* Right Side: Framed Engine Unit with Live Telemetry */}
                <div className="rounded border border-brand/50 bg-background p-3 text-[10.5px] space-y-1.5 z-10 shadow-md shadow-brand/15 min-w-[150px]">
                  <div className="flex items-center justify-between text-brand font-bold">
                    <span>strim-runner</span>
                    <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  </div>
                  <div className="text-[10px] text-foreground-muted flex justify-between">
                    <span>Active Users:</span>
                    <span className="text-foreground font-mono tabular-nums">{engineUsers.toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-foreground-muted flex justify-between">
                    <span>Throughput:</span>
                    <span className="text-success font-mono tabular-nums">{engineRps.toLocaleString()} rps</span>
                  </div>
                  <div className="text-[10px] text-foreground-subtle flex justify-between">
                    <span>Engine CPU:</span>
                    <span className="text-foreground font-mono">4.1%</span>
                  </div>
                  <div className="pt-1 border-t border-border text-[9.5px] text-success flex items-center justify-between">
                    <span>Internal Lag:</span>
                    <span className="font-mono">0.00 μs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="font-mono text-xs font-semibold text-success mb-2">04</div>
              <h3 className="font-mono text-xl sm:text-2xl font-normal text-foreground tracking-tight">
                High-capacity load engine with live telemetry.
              </h3>
              <p className="font-sans text-sm text-foreground-muted mt-3 leading-relaxed">
                Run massive tests smoothly without slowing down your computer. STRIM generates realistic user traffic across multiple regions and streams live performance charts directly to your screen with zero delay.
              </p>
              <div className="mt-5">
                <Link
                  href="#simulator"
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-success hover:text-success uppercase tracking-wider transition-colors"
                >
                  <span>HOW THE ENGINE WORKS</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* WIDE CARD 05: Step-by-Step Breaking Point Diagnosis (Interactive)    */}
        {/* ===================================================================== */}
        <div
          onMouseEnter={() => setDiagPaused(true)}
          onMouseLeave={() => setDiagPaused(false)}
          className="rounded-xl border border-border bg-surface-raised overflow-hidden group hover:border-border transition-all"
        >
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Heading, Context & Step Selection Tabs */}
              <div className="lg:col-span-5 space-y-4">
                <div className="font-mono text-xs font-semibold text-brand">05</div>
                <h3 className="font-mono text-2xl sm:text-3xl font-normal text-foreground tracking-tight">
                  Find the exact breaking point before your users do.
                </h3>
                <p className="font-sans text-sm text-foreground-muted leading-relaxed">
                  Here is how STRIM diagnoses your system: as traffic increases, the engine tracks your response times and immediately spots when your database or server reaches its maximum capacity.
                </p>

                {/* Interactive Step Switcher Tabs (RushDB style) */}
                <div className="pt-2 flex flex-col gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setDiagStep(1)}
                    className={`flex items-center justify-between p-2.5 rounded border transition-all text-left ${
                      diagStep === 1
                        ? "border-brand bg-brand/10 text-foreground"
                        : "border-border bg-background text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand">01</span>
                      <span>Spike Detection</span>
                    </div>
                    {diagStep === 1 && <span className="size-1.5 rounded-full bg-brand animate-pulse" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiagStep(2)}
                    className={`flex items-center justify-between p-2.5 rounded border transition-all text-left ${
                      diagStep === 2
                        ? "border-danger bg-danger/10 text-foreground"
                        : "border-border bg-background text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-danger">02</span>
                      <span>Root-Cause Isolation</span>
                    </div>
                    {diagStep === 2 && <span className="size-1.5 rounded-full bg-danger animate-pulse" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiagStep(3)}
                    className={`flex items-center justify-between p-2.5 rounded border transition-all text-left ${
                      diagStep === 3
                        ? "border-success bg-success/10 text-foreground"
                        : "border-border bg-background text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-success">03</span>
                      <span>Capacity Recommendation</span>
                    </div>
                    {diagStep === 3 && <span className="size-1.5 rounded-full bg-success animate-pulse" />}
                  </button>
                </div>

                <div className="pt-2">
                  <Link
                    href="#workbench"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-brand hover:text-brand-hover uppercase tracking-wider transition-colors"
                  >
                    <span>EXPLORE BREAKING POINT DIAGNOSTICS</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Terminal-style Live Diagnostic Cockpit */}
              <div className="lg:col-span-7 rounded-lg border border-border bg-surface-sunken p-5 sm:p-6 font-mono text-xs flex flex-col justify-between min-h-[360px]">
                {/* Header with question */}
                <div className="flex items-center justify-between text-foreground-subtle pb-3 border-b border-border text-[11px]">
                  <span className="text-sand flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-success animate-pulse" />
                    Q: Why did the checkout API slow down at 34,200 requests/sec?
                  </span>
                  <span className="text-success uppercase text-[9.5px]">AUTOMATED RUN</span>
                </div>

                {/* Step Content Visualizer */}
                <div className="py-4 space-y-4">
                  {/* Step 1 Visualizer */}
                  {diagStep === 1 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-brand font-semibold">
                          <span>STEP 1 · SPIKE DETECTION</span>
                        </div>
                        <span className="text-danger text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-subtle/40 border border-danger/30">
                          LATENCY +2,100%
                        </span>
                      </div>
                      <p className="text-foreground-muted text-xs leading-relaxed">
                        Response times jumped sharply from <span className="text-foreground font-bold">18ms</span> to <span className="text-danger font-bold">412ms</span> the moment traffic reached 34,200 requests/sec.
                      </p>

                      {/* Mini Latency Progression Waterfall */}
                      <div className="rounded bg-surface p-3 border border-border-subtle space-y-2 text-[10.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground-subtle w-28">0 - 28k req/s</span>
                          <div className="w-full mx-2 bg-surface-hover h-2 rounded-full overflow-hidden">
                            <div className="bg-success h-full w-[15%]" />
                          </div>
                          <span className="text-success font-mono w-14 text-right">18ms</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-foreground-subtle w-28">32k req/s (Knee)</span>
                          <div className="w-full mx-2 bg-surface-hover h-2 rounded-full overflow-hidden">
                            <div className="bg-warning h-full w-[38%]" />
                          </div>
                          <span className="text-warning font-mono w-14 text-right">46ms</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-danger w-28 font-bold">34.2k req/s (Spike)</span>
                          <div className="w-full mx-2 bg-surface-hover h-2 rounded-full overflow-hidden">
                            <div className="bg-danger h-full w-[95%] animate-pulse" />
                          </div>
                          <span className="text-danger font-mono font-bold w-14 text-right">412ms</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2 Visualizer */}
                  {diagStep === 2 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-danger font-semibold">
                          <span>STEP 2 · ROOT-CAUSE ISOLATION</span>
                        </div>
                        <span className="text-danger text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-subtle/40 border border-danger/30">
                          POOL EXHAUSTED
                        </span>
                      </div>
                      <p className="text-foreground-muted text-xs leading-relaxed">
                        Database connection pool reached maximum capacity (<span className="text-foreground font-bold">100/100 active connections</span>), causing incoming requests to queue in socket buffers.
                      </p>

                      {/* Pool Telemetry Tile */}
                      <div className="rounded bg-surface p-3 border border-border-subtle space-y-2.5 text-[10.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground-subtle">Postgres Pool Utilization:</span>
                          <span className="text-danger font-bold">100% (100 / 100)</span>
                        </div>
                        <div className="w-full bg-surface-hover h-2.5 rounded-full overflow-hidden">
                          <div className="bg-danger h-full w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                          <div className="text-foreground-subtle">
                            Queuing delay: <span className="text-foreground font-mono">+380ms</span>
                          </div>
                          <div className="text-foreground-subtle">
                            Wait queue: <span className="text-danger font-mono">4,120 reqs</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3 Visualizer */}
                  {diagStep === 3 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-success font-semibold">
                          <span>STEP 3 · CAPACITY RECOMMENDATION</span>
                        </div>
                        <span className="text-success text-[10px] font-bold px-1.5 py-0.5 rounded bg-success-subtle/40 border border-success/30">
                          ACTIONABLE FIX
                        </span>
                      </div>
                      <p className="text-foreground-muted text-xs leading-relaxed">
                        To maintain healthy response times under peak load, either increase pool size or safely cap traffic to our recommended ceiling.
                      </p>

                      {/* Recommendation Card */}
                      <div className="rounded bg-surface p-3 border border-border-subtle space-y-2 text-[10.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground-subtle">Safe Capacity Ceiling:</span>
                          <span className="text-success font-bold text-sm">31,500 req/s</span>
                        </div>
                        <div className="text-[10px] text-foreground-muted space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-success">✔</span>
                            <span>Guarantees P99 &lt; 28ms with 8% headroom buffer</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-brand">→</span>
                            <span>Action: Increase <code className="text-sand bg-surface-hover px-1 rounded">max_connections</code> to 250 or add PgBouncer</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer with Step Progress */}
                <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-[10px] text-foreground-subtle">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-success" />
                    <span>Auto-cycling diagnostic steps (Hover to pause)</span>
                  </div>
                  <span className="text-success font-mono">Step {diagStep} of 3</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
