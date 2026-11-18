"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Terminal,
  Activity,
  Zap,
  Cpu,
  Radio,
  ShieldCheck,
  ChevronRight,
  Layers,
  Play,
  Pause,
  Server,
  BarChart3,
  Clock,
  AlertTriangle,
} from "lucide-react"

// Card 01: Ingestion stream mock pool
const STREAM_POOL = [
  {
    method: "POST",
    path: "/v1/orders/8921",
    normalized: "/v1/orders/{id}",
    status: "200",
    ms: "12.4ms",
    type: "UUID grouped",
  },
  {
    method: "GET",
    path: "/v1/catalog/items/44",
    normalized: "/v1/catalog/items/{id}",
    status: "200",
    ms: "3.8ms",
    type: "Numeric ID grouped",
  },
  {
    method: "POST",
    path: "/v1/checkout/session",
    normalized: "/v1/checkout/session",
    status: "200",
    ms: "18.2ms",
    type: "Exact route verified",
  },
  {
    method: "DELETE",
    path: "/v1/cart/items/9012",
    normalized: "/v1/cart/items/{id}",
    status: "204",
    ms: "7.2ms",
    type: "Resource ID parsed",
  },
  {
    method: "POST",
    path: "/v1/auth/tokens",
    normalized: "/v1/auth/tokens",
    status: "200",
    ms: "14.1ms",
    type: "Exact route verified",
  },
  {
    method: "GET",
    path: "/v1/orders/search?q=shoes",
    normalized: "/v1/orders/search",
    status: "200",
    ms: "8.6ms",
    type: "Query params stripped",
  },
  {
    method: "PUT",
    path: "/v1/users/profile/77",
    normalized: "/v1/users/profile/{id}",
    status: "200",
    ms: "16.4ms",
    type: "Entity param grouped",
  },
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
    <section
      id="architecture"
      className="relative scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8"
    >
      <div
        id="platform-architecture"
        className="pointer-events-none absolute -top-24"
      />
      <div className="mx-auto max-w-7xl">
        {/* Section Tag & Headline */}
        <div className="mb-10 flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-brand uppercase">
            <span>[03]</span>
            <span>HOW STRIM LABS WORKS</span>
          </div>
          <h2 className="max-w-full font-mono text-2xl font-normal tracking-[-0.03em] text-foreground sm:text-3xl">
            Everything you need to test, monitor, and scale your APIs.
          </h2>
          <p className="mt-2 font-sans text-base leading-relaxed text-sand">
            Most teams only discover their server&apos;s limits during an
            outage. STRIM Labs automatically maps your endpoints, simulates
            realistic user traffic, and pinpoints exactly where your system
            slows down—so you can fix bottlenecks with confidence.
          </p>
        </div>

        {/* 4 Stat Columns (RushDB Style) */}
        <div className="mb-12 rounded-xl border border-border bg-surface-raised p-6 sm:p-8">
          <div className="mb-6 font-mono text-xs tracking-wider text-foreground-muted uppercase">
            Engineered for high performance · Zero setup required
          </div>
          <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
            <div>
              <div className="font-mono text-4xl font-normal tracking-tight text-brand">
                500k<span className="text-2xl text-brand/70">+</span>
              </div>
              <div className="mt-2 font-mono text-xs font-semibold text-foreground sm:text-sm">
                simultaneous users
              </div>
              <div className="mt-1 font-sans text-xs leading-relaxed text-foreground-subtle">
                Simulate massive traffic without crashing your laptop or
                dropping calls
              </div>
            </div>

            <div>
              <div className="font-mono text-4xl font-normal tracking-tight text-success">
                0
              </div>
              <div className="mt-2 font-mono text-xs font-semibold text-foreground sm:text-sm">
                fake zeros or guesses
              </div>
              <div className="mt-1 font-sans text-xs leading-relaxed text-foreground-subtle">
                Real, unmasked response times for every single request
              </div>
            </div>

            <div>
              <div className="font-mono text-4xl font-normal tracking-tight text-brand">
                100<span className="text-2xl font-normal text-sand">%</span>
              </div>
              <div className="mt-2 font-mono text-xs font-semibold text-foreground sm:text-sm">
                timing accuracy
              </div>
              <div className="mt-1 font-sans text-xs leading-relaxed text-foreground-subtle">
                Test runner operates with zero internal lag skewing your metrics
              </div>
            </div>

            <div>
              <div className="font-mono text-4xl font-normal tracking-tight text-success">
                &lt;1<span className="text-2xl font-normal text-sand">s</span>
              </div>
              <div className="mt-2 font-mono text-xs font-semibold text-foreground sm:text-sm">
                live dashboard updates
              </div>
              <div className="mt-1 font-sans text-xs leading-relaxed text-foreground-subtle">
                Watch response times and error rates update live on your screen
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2x2 Bento Grid (RushDB Style with hairline interior borders)          */}
        {/* ===================================================================== */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ========================================================= */}
          {/* CARD 01: Ingestion & Live Endpoint Discovery              */}
          {/* ========================================================= */}
          <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface-raised transition-all hover:border-border">
            {/* Visualizer Header */}
            <div className="border-b border-border bg-surface-sunken p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 font-mono text-[11px] leading-relaxed sm:grid-cols-2">
                {/* Left: Live Request Stream with moving indicator */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-[10px] tracking-wider text-foreground-subtle uppercase">
                    <span>incoming requests</span>
                    <span className="flex items-center gap-1 text-[9.5px] text-success">
                      <span className="size-1 animate-pulse rounded-full bg-success" />
                      sniffing
                    </span>
                  </div>
                  <div className="space-y-1.5 text-foreground-muted">
                    {currentStreamSlice.map((item, idx) => {
                      const isLatest = idx === 0
                      return (
                        <div
                          key={`${item.path}-${idx}`}
                          className={`flex items-center justify-between rounded p-1.5 transition-all duration-300 ${
                            isLatest
                              ? "border border-success/40 bg-surface-hover text-foreground shadow-xs"
                              : "bg-background/60 text-foreground-muted"
                          }`}
                        >
                          <div className="flex max-w-[140px] items-center gap-1.5 truncate">
                            <span
                              className={`text-[10px] font-bold ${
                                item.method === "POST"
                                  ? "text-brand"
                                  : item.method === "GET"
                                    ? "text-success"
                                    : "text-warning"
                              }`}
                            >
                              {item.method}
                            </span>
                            <span className="truncate text-[10.5px]">
                              {item.path}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 text-[10px]">
                            <span
                              className={
                                item.status === "200" || item.status === "204"
                                  ? "text-success"
                                  : "text-danger"
                              }
                            >
                              {item.status}
                            </span>
                            <span className="text-foreground-subtle">
                              {item.ms}
                            </span>
                            {isLatest && (
                              <span className="animate-pulse text-success">
                                ●─→
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right: Dynamic Route Catalog with live auto-incrementing counters */}
                <div className="border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                  <div className="mb-2 flex items-center justify-between text-[10px] tracking-wider text-foreground-subtle uppercase">
                    <span>catalog · ENDPOINTS</span>
                    <span className="text-success">SYNCED</span>
                  </div>
                  <div className="space-y-1.5 text-[10.5px]">
                    <div className="flex justify-between border-b border-border pb-1 text-[9.5px] text-foreground-subtle">
                      <span>endpoint</span>
                      <span>latency</span>
                      <span>calls</span>
                    </div>

                    <div className="flex items-center justify-between py-0.5 text-foreground">
                      <span className="max-w-[105px] truncate text-brand">
                        POST /orders
                      </span>
                      <span className="text-sand">18ms</span>
                      <span className="font-mono text-foreground-muted tabular-nums">
                        {catalogCounts.orders.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-0.5 text-foreground">
                      <span className="max-w-[105px] truncate text-success">
                        GET /catalog
                      </span>
                      <span className="text-sand">4ms</span>
                      <span className="font-mono text-foreground-muted tabular-nums">
                        {catalogCounts.catalog.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-0.5 text-foreground">
                      <span className="max-w-[105px] truncate text-brand">
                        POST /auth
                      </span>
                      <span className="text-sand">24ms</span>
                      <span className="font-mono text-foreground-muted tabular-nums">
                        {catalogCounts.auth.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded border border-danger/30 bg-danger-subtle px-1.5 py-0.5 text-danger">
                      <span className="max-w-[105px] truncate font-semibold">
                        POST /checkout
                      </span>
                      <span className="font-bold">412ms</span>
                      <span className="font-mono tabular-nums">
                        {catalogCounts.checkout.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[9.5px] text-foreground-subtle">
                    <span>Pattern: dynamic IDs normalized</span>
                    <span className="text-success">0 config</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="mb-2 font-mono text-xs font-semibold text-brand">
                01
              </div>
              <h3 className="font-mono text-xl font-normal tracking-tight text-foreground sm:text-2xl">
                Automatic API discovery on every request.
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-foreground-muted">
                No manual route typing or configuration. STRIM automatically
                detects your API endpoints from real traffic, groups dynamic
                URLs (like{" "}
                <code className="rounded bg-surface-hover px-1 py-0.5 text-sand">
                  /orders/4921
                </code>{" "}
                into{" "}
                <code className="rounded bg-surface-hover px-1 py-0.5 text-sand">
                  /orders/{"{id}"}
                </code>
                ), and tracks latency trends in real time.
              </p>
              <div className="mt-5">
                <Link
                  href="#workbench"
                  className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-brand uppercase transition-colors hover:text-brand-hover"
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
          <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface-raised transition-all hover:border-border">
            {/* Visualizer Header: Interactive Facet Switcher like RushDB */}
            <div className="border-b border-border bg-surface-sunken p-5 sm:p-6">
              <div className="font-mono text-[11px] leading-relaxed">
                <div className="mb-2 flex items-center justify-between text-[10px] tracking-wider text-foreground-subtle uppercase">
                  <span>target · CHECKOUT_SERVICE</span>
                  <span className="text-success">100% UNMASKED</span>
                </div>

                {/* Interactive Facet Pill Switcher */}
                <div className="mb-3.5 flex items-center gap-1.5 border-b border-border-subtle pb-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveFacet("status")}
                    className={`rounded px-2.5 py-1 font-mono text-[10px] transition-colors ${
                      activeFacet === "status"
                        ? "border border-border bg-surface-hover font-semibold text-foreground"
                        : "text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    By Status Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFacet("tier")}
                    className={`rounded px-2.5 py-1 font-mono text-[10px] transition-colors ${
                      activeFacet === "tier"
                        ? "border border-border bg-surface-hover font-semibold text-foreground"
                        : "text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    By Latency Tier
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFacet("phase")}
                    className={`rounded px-2.5 py-1 font-mono text-[10px] transition-colors ${
                      activeFacet === "phase"
                        ? "border border-border bg-surface-hover font-semibold text-foreground"
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
                      <span className="w-24 shrink-0 font-medium text-success">
                        200 OK
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-success select-none">
                        ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground tabular-nums">
                        142,920
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-warning">
                        429 LIMITED
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-warning select-none">
                        ■■■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground-muted tabular-nums">
                        1,840
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-danger">
                        504 TIMEOUT
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-danger select-none">
                        ■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground-muted tabular-nums">
                        412
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-foreground-subtle">
                        500 ERR
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-foreground-subtle select-none">
                        ▫
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground-subtle tabular-nums">
                        28
                      </span>
                    </div>
                  </div>
                )}

                {activeFacet === "tier" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-success">
                        &lt; 10ms Fast
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-success select-none">
                        ■■■■■■■■■■■■■■■■■■■■■■■■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground tabular-nums">
                        118,400
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-brand">
                        10-50ms Norm
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-brand select-none">
                        ■■■■■■■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground-muted tabular-nums">
                        24,120
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-warning">
                        50-200ms Slow
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-warning select-none">
                        ■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground-muted tabular-nums">
                        2,268
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-danger">
                        &gt; 200ms Spike
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-danger select-none">
                        ▫
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-danger tabular-nums">
                        412
                      </span>
                    </div>
                  </div>
                )}

                {activeFacet === "phase" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-foreground-muted">
                        DNS Lookup
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-foreground-subtle select-none">
                        ■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground">
                        0.8ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-foreground-muted">
                        TCP + TLS
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-brand select-none">
                        ■■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground">
                        2.4ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-success">
                        Server TTFB
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-success select-none">
                        ■■■■■■■■■■■■■■■■■■■■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-success">
                        12.1ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="w-24 shrink-0 font-medium text-foreground-muted">
                        Transfer
                      </span>
                      <span className="truncate px-2 font-mono tracking-tighter text-foreground-subtle select-none">
                        ■■
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-foreground">
                        1.8ms
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[10px] text-foreground-subtle">
                  <span>total requests: 145,200</span>
                  <span className="text-success">Zero fake zeros</span>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="mb-2 font-mono text-xs font-semibold text-success">
                02
              </div>
              <h3 className="font-mono text-xl font-normal tracking-tight text-foreground sm:text-2xl">
                True response times. No hidden delays.
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-foreground-muted">
                See exactly where time is spent on every request. STRIM
                separates connection setup, server processing, and network
                transfer so you know immediately whether delays come from your
                code, third-party APIs, or your database.
              </p>
              <div className="mt-5">
                <Link
                  href="#benchmarks"
                  className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-success uppercase transition-colors hover:text-success"
                >
                  <span>SEE LATENCY METRICS</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row of 2x2 Bento Grid */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ========================================================= */}
          {/* CARD 03: Spec In, Verified Execution Tree Out             */}
          {/* ========================================================= */}
          <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface-raised transition-all hover:border-border">
            {/* Visualizer Header */}
            <div className="border-b border-border bg-surface-sunken p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-5 font-mono text-[11px] leading-relaxed sm:grid-cols-2">
                {/* Left: Target Config / OpenAPI Payload */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-[10px] tracking-wider text-foreground-subtle uppercase">
                    <span>one spec</span>
                    <span className="text-[9.5px] text-brand">OpenAPI 3.x</span>
                  </div>
                  <div className="relative overflow-hidden rounded border border-border bg-surface p-2.5 font-mono text-[10.5px] text-foreground-muted">
                    <div>
                      <span className="text-sand">&#123;</span>
                    </div>
                    <div className="pl-3">
                      <span className="text-brand">&quot;service&quot;</span>:{" "}
                      <span className="text-success">
                        &quot;checkout-api&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-3">
                      <span className="text-brand">&quot;url&quot;</span>:{" "}
                      <span className="text-sand">
                        &quot;https://api.myapp.com&quot;
                      </span>
                      ,
                    </div>
                    <div className="pl-3">
                      <span className="text-brand">&quot;routes&quot;</span>: [
                    </div>
                    <div className="pl-6">
                      <span className="text-foreground-muted">
                        &#123; &quot;path&quot;: &quot;/v1/orders&quot; &#125;,
                      </span>
                    </div>
                    <div className="pl-6">
                      <span className="text-foreground-muted">
                        &#123; &quot;path&quot;: &quot;/v1/checkout&quot; &#125;
                      </span>
                    </div>
                    <div className="pl-3">]</div>
                    <div>
                      <span className="text-sand">&#125;</span>
                    </div>

                    {/* Subtle scanning pulse beam */}
                    <div className="absolute inset-x-0 h-[1.5px] animate-[marquee-horizontal_3s_ease-in-out_infinite] bg-brand/40" />
                  </div>
                </div>

                {/* Right: Linked Route Hierarchy Tree (RushDB Style) */}
                <div className="border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                  <div className="mb-2 flex items-center justify-between text-[10px] tracking-wider text-foreground-subtle uppercase">
                    <span>linked endpoints</span>
                    <span className="flex items-center gap-1 text-[9.5px] text-success">
                      <span className="size-1 animate-pulse rounded-full bg-success" />
                      READY
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-[10.5px] text-sand">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <span className="size-1.5 rounded-full bg-success" />
                      <span>checkout-api</span>
                      <span className="rounded border border-success/30 bg-success-subtle/40 px-1 text-[9px] font-normal text-success/80">
                        VERIFIED
                      </span>
                    </div>
                    <div className="pl-3 text-foreground-muted">
                      <div>
                        ├── <span className="text-brand">orders</span> (POST)
                      </div>
                      <div className="pl-4 text-foreground-subtle">
                        ├── Safe ceiling:{" "}
                        <span className="text-success">10k req/s</span>
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
                        └── Health check:{" "}
                        <span className="text-success">Passing</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[9.5px] text-foreground-subtle">
                    <span>sha256: 9b4f2c...</span>
                    <span className="text-success">Ready to test</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="mb-2 font-mono text-xs font-semibold text-brand">
                03
              </div>
              <h3 className="font-mono text-xl font-normal tracking-tight text-foreground sm:text-2xl">
                Import your API or let STRIM scan automatically.
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-foreground-muted">
                Connect your server in seconds: upload your API documentation or
                let our lightweight GitHub Action scan your repository. STRIM
                verifies server ownership safely and prepares your routes for
                testing immediately.
              </p>
              <div className="mt-5">
                <Link
                  href="#methodology"
                  className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-brand uppercase transition-colors hover:text-brand-hover"
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
          <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface-raised transition-all hover:border-border">
            {/* Visualizer Header */}
            <div className="border-b border-border bg-surface-sunken p-5 sm:p-6">
              <div className="relative flex items-center justify-between font-mono text-[11px]">
                {/* Left Side: Pipeline Inputs */}
                <div className="z-10 space-y-2.5">
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="font-bold text-brand">&#123; &#125;</span>
                    <span className="text-[11px]">distributed runners</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="font-bold text-success">~</span>
                    <span className="text-[11px]">live traffic feed</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="font-bold text-warning">⏱</span>
                    <span className="text-[11px]">microsecond accuracy</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="font-bold text-brand">⚡</span>
                    <span className="text-[11px]">real-time updates</span>
                  </div>
                </div>

                {/* Center SVG Circuit Wire with Traveling Signal Pulses */}
                <div className="pointer-events-none absolute inset-x-24 inset-y-0 flex items-center justify-center">
                  <svg
                    className="h-28 w-full"
                    viewBox="0 0 160 100"
                    fill="none"
                  >
                    {/* Circuit lines */}
                    <path
                      d="M 0,20 L 50,20 L 70,50 L 160,50"
                      stroke="var(--border-subtle)"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 0,40 L 40,40 L 65,50 L 160,50"
                      stroke="var(--border-subtle)"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 0,60 L 40,60 L 65,50 L 160,50"
                      stroke="var(--border-subtle)"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M 0,80 L 50,80 L 70,50 L 160,50"
                      stroke="var(--border-subtle)"
                      strokeWidth="1.5"
                    />

                    {/* Animated moving pulses */}
                    <circle r="3" fill="var(--brand)">
                      <animateMotion
                        dur="2.4s"
                        repeatCount="indefinite"
                        path="M 0,20 L 50,20 L 70,50 L 160,50"
                      />
                    </circle>
                    <circle r="3" fill="var(--success)">
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path="M 0,40 L 40,40 L 65,50 L 160,50"
                      />
                    </circle>
                    <circle r="3" fill="var(--warning)">
                      <animateMotion
                        dur="2.8s"
                        repeatCount="indefinite"
                        path="M 0,60 L 40,60 L 65,50 L 160,50"
                      />
                    </circle>
                    <circle r="3" fill="var(--brand)">
                      <animateMotion
                        dur="2.2s"
                        repeatCount="indefinite"
                        path="M 0,80 L 50,80 L 70,50 L 160,50"
                      />
                    </circle>
                  </svg>
                </div>

                {/* Right Side: Framed Engine Unit with Live Telemetry */}
                <div className="z-10 min-w-[150px] space-y-1.5 rounded border border-brand/50 bg-background p-3 text-[10.5px] shadow-md shadow-brand/15">
                  <div className="flex items-center justify-between font-bold text-brand">
                    <span>strim-runner</span>
                    <span className="size-1.5 animate-pulse rounded-full bg-success" />
                  </div>
                  <div className="flex justify-between text-[10px] text-foreground-muted">
                    <span>Active Users:</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {engineUsers.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-foreground-muted">
                    <span>Throughput:</span>
                    <span className="font-mono text-success tabular-nums">
                      {engineRps.toLocaleString()} rps
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-foreground-subtle">
                    <span>Engine CPU:</span>
                    <span className="font-mono text-foreground">4.1%</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-1 text-[9.5px] text-success">
                    <span>Internal Lag:</span>
                    <span className="font-mono">0.00 μs</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Text */}
            <div className="p-6 sm:p-7">
              <div className="mb-2 font-mono text-xs font-semibold text-success">
                04
              </div>
              <h3 className="font-mono text-xl font-normal tracking-tight text-foreground sm:text-2xl">
                High-capacity load engine with live telemetry.
              </h3>
              <p className="mt-3 font-sans text-sm leading-relaxed text-foreground-muted">
                Run massive tests smoothly without slowing down your computer.
                STRIM generates realistic user traffic across multiple regions
                and streams live performance charts directly to your screen with
                zero delay.
              </p>
              <div className="mt-5">
                <Link
                  href="#simulator"
                  className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-success uppercase transition-colors hover:text-success"
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
          className="group overflow-hidden rounded-xl border border-border bg-surface-raised transition-all hover:border-border"
        >
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              {/* Left Column: Heading, Context & Step Selection Tabs */}
              <div className="space-y-4 lg:col-span-5">
                <div className="font-mono text-xs font-semibold text-brand">
                  05
                </div>
                <h3 className="font-mono text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                  Find the exact breaking point before your users do.
                </h3>
                <p className="font-sans text-sm leading-relaxed text-foreground-muted">
                  Here is how STRIM diagnoses your system: as traffic increases,
                  the engine tracks your response times and immediately spots
                  when your database or server reaches its maximum capacity.
                </p>

                {/* Interactive Step Switcher Tabs (RushDB style) */}
                <div className="flex flex-col gap-2 pt-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setDiagStep(1)}
                    className={`flex items-center justify-between rounded border p-2.5 text-left transition-all ${
                      diagStep === 1
                        ? "border-brand bg-brand/10 text-foreground"
                        : "border-border bg-background text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand">01</span>
                      <span>Spike Detection</span>
                    </div>
                    {diagStep === 1 && (
                      <span className="size-1.5 animate-pulse rounded-full bg-brand" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiagStep(2)}
                    className={`flex items-center justify-between rounded border p-2.5 text-left transition-all ${
                      diagStep === 2
                        ? "border-danger bg-danger/10 text-foreground"
                        : "border-border bg-background text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-danger">02</span>
                      <span>Root-Cause Isolation</span>
                    </div>
                    {diagStep === 2 && (
                      <span className="size-1.5 animate-pulse rounded-full bg-danger" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiagStep(3)}
                    className={`flex items-center justify-between rounded border p-2.5 text-left transition-all ${
                      diagStep === 3
                        ? "border-success bg-success/10 text-foreground"
                        : "border-border bg-background text-foreground-subtle hover:text-sand"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-success">03</span>
                      <span>Capacity Recommendation</span>
                    </div>
                    {diagStep === 3 && (
                      <span className="size-1.5 animate-pulse rounded-full bg-success" />
                    )}
                  </button>
                </div>

                <div className="pt-2">
                  <Link
                    href="#workbench"
                    className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider text-brand uppercase transition-colors hover:text-brand-hover"
                  >
                    <span>EXPLORE BREAKING POINT DIAGNOSTICS</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Right Column: Terminal-style Live Diagnostic Cockpit */}
              <div className="flex min-h-[360px] flex-col justify-between rounded-lg border border-border bg-surface-sunken p-5 font-mono text-xs sm:p-6 lg:col-span-7">
                {/* Header with question */}
                <div className="flex items-center justify-between border-b border-border pb-3 text-[11px] text-foreground-subtle">
                  <span className="flex items-center gap-2 text-sand">
                    <span className="size-1.5 animate-pulse rounded-full bg-success" />
                    Q: Why did the checkout API slow down at 34,200
                    requests/sec?
                  </span>
                  <span className="text-[9.5px] text-success uppercase">
                    AUTOMATED RUN
                  </span>
                </div>

                {/* Step Content Visualizer */}
                <div className="space-y-4 py-4">
                  {/* Step 1 Visualizer */}
                  {diagStep === 1 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-brand">
                          <span>STEP 1 · SPIKE DETECTION</span>
                        </div>
                        <span className="rounded border border-danger/30 bg-danger-subtle/40 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                          LATENCY +2,100%
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground-muted">
                        Response times jumped sharply from{" "}
                        <span className="font-bold text-foreground">18ms</span>{" "}
                        to <span className="font-bold text-danger">412ms</span>{" "}
                        the moment traffic reached 34,200 requests/sec.
                      </p>

                      {/* Mini Latency Progression Waterfall */}
                      <div className="space-y-2 rounded border border-border-subtle bg-surface p-3 text-[10.5px]">
                        <div className="flex items-center justify-between">
                          <span className="w-28 text-foreground-subtle">
                            0 - 28k req/s
                          </span>
                          <div className="mx-2 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                            <div className="h-full w-[15%] bg-success" />
                          </div>
                          <span className="w-14 text-right font-mono text-success">
                            18ms
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="w-28 text-foreground-subtle">
                            32k req/s (Knee)
                          </span>
                          <div className="mx-2 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                            <div className="h-full w-[38%] bg-warning" />
                          </div>
                          <span className="w-14 text-right font-mono text-warning">
                            46ms
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="w-28 font-bold text-danger">
                            34.2k req/s (Spike)
                          </span>
                          <div className="mx-2 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                            <div className="h-full w-[95%] animate-pulse bg-danger" />
                          </div>
                          <span className="w-14 text-right font-mono font-bold text-danger">
                            412ms
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2 Visualizer */}
                  {diagStep === 2 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-danger">
                          <span>STEP 2 · ROOT-CAUSE ISOLATION</span>
                        </div>
                        <span className="rounded border border-danger/30 bg-danger-subtle/40 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                          POOL EXHAUSTED
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground-muted">
                        Database connection pool reached maximum capacity (
                        <span className="font-bold text-foreground">
                          100/100 active connections
                        </span>
                        ), causing incoming requests to queue in socket buffers.
                      </p>

                      {/* Pool Telemetry Tile */}
                      <div className="space-y-2.5 rounded border border-border-subtle bg-surface p-3 text-[10.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground-subtle">
                            Postgres Pool Utilization:
                          </span>
                          <span className="font-bold text-danger">
                            100% (100 / 100)
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                          <div className="h-full w-full bg-danger" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                          <div className="text-foreground-subtle">
                            Queuing delay:{" "}
                            <span className="font-mono text-foreground">
                              +380ms
                            </span>
                          </div>
                          <div className="text-foreground-subtle">
                            Wait queue:{" "}
                            <span className="font-mono text-danger">
                              4,120 reqs
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3 Visualizer */}
                  {diagStep === 3 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-success">
                          <span>STEP 3 · CAPACITY RECOMMENDATION</span>
                        </div>
                        <span className="rounded border border-success/30 bg-success-subtle/40 px-1.5 py-0.5 text-[10px] font-bold text-success">
                          ACTIONABLE FIX
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground-muted">
                        To maintain healthy response times under peak load,
                        either increase pool size or safely cap traffic to our
                        recommended ceiling.
                      </p>

                      {/* Recommendation Card */}
                      <div className="space-y-2 rounded border border-border-subtle bg-surface p-3 text-[10.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground-subtle">
                            Safe Capacity Ceiling:
                          </span>
                          <span className="text-sm font-bold text-success">
                            31,500 req/s
                          </span>
                        </div>
                        <div className="space-y-1 text-[10px] text-foreground-muted">
                          <div className="flex items-center gap-1.5">
                            <span className="text-success">✔</span>
                            <span>
                              Guarantees P99 &lt; 28ms with 8% headroom buffer
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-brand">→</span>
                            <span>
                              Action: Increase{" "}
                              <code className="rounded bg-surface-hover px-1 text-sand">
                                max_connections
                              </code>{" "}
                              to 250 or add PgBouncer
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer with Step Progress */}
                <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-[10px] text-foreground-subtle">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-success" />
                    <span>Auto-cycling diagnostic steps (Hover to pause)</span>
                  </div>
                  <span className="font-mono text-success">
                    Step {diagStep} of 3
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
