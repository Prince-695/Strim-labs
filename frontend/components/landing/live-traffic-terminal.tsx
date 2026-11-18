"use client"

import * as React from "react"
import { Activity, ShieldCheck, Terminal, Server, ArrowUpRight } from "lucide-react"

interface TrafficRow {
  id: number
  protocol: "http" | "grpc" | "gql"
  method: string
  endpoint: string
  rps: string
  latency: string
  status: "200" | "429" | "504" | "201"
  statusText: string
  badgeColor: string
}

const INITIAL_ROWS: TrafficRow[] = [
  { id: 1, protocol: "http", method: "GET", endpoint: "/api/v1/feed", rps: "24,000 RPS", latency: "12.4 ms", status: "200", statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
  { id: 2, protocol: "grpc", method: "CALL", endpoint: "OrderService.Create", rps: "8,500 RPS", latency: "28.1 ms", status: "200", statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
  { id: 3, protocol: "http", method: "POST", endpoint: "/api/v1/checkout", rps: "14,200 RPS", latency: "380.0 ms", status: "429", statusText: "429 RATE LIMIT", badgeColor: "text-warning border-warning-subtle bg-warning-subtle/30" },
  { id: 4, protocol: "gql", method: "QUERY", endpoint: "GetProductCatalog", rps: "19,800 RPS", latency: "16.8 ms", status: "200", statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
  { id: 5, protocol: "http", method: "POST", endpoint: "/api/v1/checkout", rps: "18,900 RPS", latency: "1,420.0 ms", status: "504", statusText: "504 TIMEOUT", badgeColor: "text-danger border-danger-subtle bg-danger-subtle/30" },
  { id: 6, protocol: "http", method: "POST", endpoint: "/api/v1/auth/tokens", rps: "11,400 RPS", latency: "18.2 ms", status: "201", statusText: "201 CREATED", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
  { id: 7, protocol: "grpc", method: "CALL", endpoint: "Inventory.ReserveStock", rps: "6,200 RPS", latency: "9.4 ms", status: "200", statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
  { id: 8, protocol: "http", method: "GET", endpoint: "/api/v1/metrics/stream", rps: "31,000 RPS", latency: "2.1 ms", status: "200", statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
]

export function LiveTrafficTerminal() {
  const [rows, setRows] = React.useState<TrafficRow[]>(INITIAL_ROWS)
  const [totalRequests, setTotalRequests] = React.useState<number>(148920400)
  const [activeRps, setActiveRps] = React.useState<number>(184200)

  // Infinitely running real-time traffic row generation
  React.useEffect(() => {
    const endpoints = [
      { protocol: "http" as const, method: "POST", endpoint: "/api/v1/orders/submit", rps: "16,400 RPS", latency: "14.2 ms", status: "200" as const, statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
      { protocol: "grpc" as const, method: "CALL", endpoint: "PaymentGateway.Charge", rps: "7,800 RPS", latency: "34.8 ms", status: "200" as const, statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
      { protocol: "gql" as const, method: "MUTATION", endpoint: "UpdateUserProfile", rps: "9,100 RPS", latency: "21.6 ms", status: "200" as const, statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
      { protocol: "http" as const, method: "GET", endpoint: "/api/v1/search/products", rps: "28,500 RPS", latency: "11.9 ms", status: "200" as const, statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
      { protocol: "http" as const, method: "POST", endpoint: "/api/v1/checkout", rps: "19,200 RPS", latency: "1,680.0 ms", status: "504" as const, statusText: "504 TIMEOUT", badgeColor: "text-danger border-danger-subtle bg-danger-subtle/30" },
      { protocol: "http" as const, method: "GET", endpoint: "/api/v1/accounts/me", rps: "12,900 RPS", latency: "8.4 ms", status: "200" as const, statusText: "200 OK", badgeColor: "text-success border-success-subtle bg-success-subtle/30" },
    ]

    let counter = 100
    const interval = setInterval(() => {
      counter++
      const randomRow = endpoints[Math.floor(Math.random() * endpoints.length)]
      setRows((prev) => [
        { ...randomRow, id: counter },
        ...prev.slice(0, 7),
      ])
      setTotalRequests((prev) => prev + Math.floor(1800 + Math.random() * 800))
      setActiveRps(Math.floor(182000 + Math.random() * 6000))
    }, 1100)

    return () => clearInterval(interval)
  }, [])

  return (
    <section id="simulator" className="scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="flex flex-col items-start gap-3 mb-10">
          <div className="flex items-center gap-2 font-mono text-xs text-foreground-subtle uppercase tracking-wider">
            <span className="text-brand">[05]</span>
            <span>LIVE TRAFFIC SIMULATOR</span>
          </div>
          <h2 className="font-mono text-2xl sm:text-3xl font-normal text-foreground max-w-full">
            Watch live traffic streams in real time.
          </h2>
          <p className="font-sans text-sm text-sand ">
            Full support for REST, gRPC, and GraphQL APIs. Watch response times, throughput, and error rates update live on your screen as traffic flows.
          </p>
        </div>

        {/* Protocol Wire Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-6 font-mono text-xs">
          <span className="text-foreground-subtle mr-2">SUPPORTED APIS:</span>
          <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
            REST API
          </span>
          <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-brand">
            gRPC
          </span>
          <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-sand">
            GraphQL
          </span>
          <span className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-success">
            Live SSE Streams
          </span>
        </div>

        {/* Live Simulator Terminal Container */}
        <div className="rounded-xl border border-border-subtle bg-surface-raised overflow-hidden shadow-2xl">
          {/* Terminal Title Bar */}
          <div className="flex items-center justify-between border-b border-border-subtle bg-background px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-xs text-foreground font-bold">
                LIVE TRAFFIC FEED · DISTRIBUTED RUNNER ZONE US-EAST
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-foreground-subtle">
              <span>ACTIVE RPS: <strong className="text-brand">{activeRps.toLocaleString()}</strong></span>
              <span>·</span>
              <span>RUNNERS: 12 CLUSTERS</span>
            </div>
          </div>

          {/* Real-time Streaming Rows */}
          <div className="p-4 sm:p-6 space-y-2 font-mono text-xs">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded border border-border bg-background p-3 hover:border-border transition-colors gap-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      row.protocol === "grpc"
                        ? "bg-brand/20 text-brand"
                        : row.protocol === "gql"
                        ? "bg-purple-950/60 text-purple-400"
                        : "bg-surface-hover text-sand"
                    }`}
                  >
                    {row.protocol}
                  </span>
                  <span className="text-foreground-subtle font-bold w-12">{row.method}</span>
                  <span className="text-foreground font-medium">{row.endpoint}</span>
                </div>

                <div className="flex items-center gap-4 sm:justify-end">
                  <span className="text-foreground-subtle text-[11px]">{row.rps}</span>
                  <span className="text-sand font-semibold w-20 text-right">{row.latency}</span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${row.badgeColor}`}
                  >
                    {row.statusText}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Aggregate Live Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 sm:p-6 border-t border-border-subtle bg-background font-mono">
            <div>
              <p className="text-[10px] text-foreground-subtle uppercase">TOTAL STRESS REQUESTS</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                {totalRequests.toLocaleString()}
              </p>
              <p className="text-[10px] text-success mt-0.5">+1,850 req / sec</p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-subtle uppercase">PEAK SUSTAINED THROUGHPUT</p>
              <p className="text-xl sm:text-2xl font-bold text-brand mt-1">
                185,000 <span className="text-xs text-foreground-subtle">RPS</span>
              </p>
              <p className="text-[10px] text-foreground-muted mt-0.5">Microsecond precision</p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-subtle uppercase">P99 SLA THRESHOLD</p>
              <p className="text-xl sm:text-2xl font-bold text-sand mt-1">
                45 <span className="text-xs text-foreground-subtle">ms</span>
              </p>
              <p className="text-[10px] text-foreground-muted mt-0.5">Deterministic enforcement</p>
            </div>
            <div>
              <p className="text-[10px] text-foreground-subtle uppercase">DETECTED BREAKING KNEE</p>
              <p className="text-xl sm:text-2xl font-bold text-danger mt-1">
                38,400 <span className="text-xs text-foreground-subtle">RPS</span>
              </p>
              <p className="text-[10px] text-danger mt-0.5">Thread pool starvation</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
