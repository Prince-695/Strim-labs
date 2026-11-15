import * as React from "react"
import { Cpu, Gauge, GitCompare, Radio, Network, Key } from "lucide-react"

const pillars = [
  {
    icon: Cpu,
    title: "Dual-Engine Load Models",
    description:
      "Run both open arrival-rate and closed virtual-user models. Prevent coordinated omission with sub-millisecond HDR histograms and high-concurrency worker scheduling.",
    tag: "Open / Closed Models",
  },
  {
    icon: Gauge,
    title: "Algorithmic Knee Detection",
    description:
      "Automated capacity analysis computes your sustainable throughput and detects the inflection point where queuing delays compound into saturation knees.",
    tag: "Capacity Knee Detection",
  },
  {
    icon: GitCompare,
    title: "Regression Comparison Studio",
    description:
      "Compare 2 to 5 test runs with synchronized timeseries overlays. Quantify latency deltas, throughput shifts, and enforce strict release criteria.",
    tag: "Delta Comparison",
  },
  {
    icon: Radio,
    title: "Real-Time Telemetry & SSE",
    description:
      "Stream live request volume, status code distributions, and percentiles over authenticated Server-Sent Events with automatic reconnect and stale data warnings.",
    tag: "Sub-Second Live Stream",
  },
  {
    icon: Network,
    title: "Endpoint Discovery & Catalog",
    description:
      "Import OpenAPI v3 or declarative JSON manifests to catalog routes, track individual endpoint rate limits, and isolate slow routes by impact score.",
    tag: "Route Registry",
  },
  {
    icon: Key,
    title: "Developer Platform & CI/CD",
    description:
      "Automate testing in deployment pipelines using scoped API keys, outbound signed webhooks, and incident dispatch to Slack or custom webhooks.",
    tag: "Automation Ready",
  },
]

export function ProductPillars() {
  return (
    <section id="capabilities" className="py-20 lg:py-28 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-mono text-sand mb-4">
            <span>ENGINEERING FOUNDATION</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl font-heading">
            Built for precision, not theater
          </h2>
          <p className="mt-4 text-sm sm:text-base text-foreground-muted leading-relaxed">
            Every metric in STRIM is measured directly from actual execution. No fabricated curves,
            no placeholder zeros, and no superficial dials.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon
            return (
              <div
                key={pillar.title}
                className="group rounded-xl border border-border bg-surface p-6 shadow-xs transition-colors hover:border-border-subtle hover:bg-surface-raised"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised text-brand group-hover:border-brand/40">
                    <Icon className="size-5" />
                  </div>
                  <span className="font-mono text-[10px] text-foreground-subtle border border-border-subtle rounded px-2 py-0.5">
                    {pillar.tag}
                  </span>
                </div>

                <h3 className="mt-5 text-base font-semibold text-foreground font-heading">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-foreground-muted leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
