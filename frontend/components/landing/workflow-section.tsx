import * as React from "react"
import { ShieldCheck, PlayCircle, BarChart3, ArrowRight } from "lucide-react"

const steps = [
  {
    step: "01",
    title: "Verify Target API",
    badge: "Security by Design",
    description:
      "Register your target service endpoint and verify domain ownership via automated DNS TXT record challenges. Netguard filters prevent unauthorized internal network attacks.",
    icon: ShieldCheck,
    accent: "text-success",
    border: "border-success/30",
  },
  {
    step: "02",
    title: "Configure Distributed Runner",
    badge: "Open & Closed Models",
    description:
      "Choose execution profiles: Smoke Probe, Capacity Ramp, Spike Surge, or Breaking Point Hunt. Fine-tune arrival rates, virtual users, and endpoint traffic distributions.",
    icon: PlayCircle,
    accent: "text-brand",
    border: "border-brand/30",
  },
  {
    step: "03",
    title: "Observe & Analyze Breaking Points",
    badge: "Statistical Knee Detection",
    description:
      "Stream live throughput and latency histograms via SSE. Our automated analysis engine pinpoints the exact RPS where performance knees, comparing deltas against baseline runs.",
    icon: BarChart3,
    accent: "text-sand",
    border: "border-sand/30",
  },
]

export function WorkflowSection() {
  return (
    <section id="workflow" className="border-t border-border/80 bg-surface/40 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-mono text-sand mb-4">
            <span>END-TO-END WORKFLOW</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl font-heading">
            Three steps from target to truth
          </h2>
          <p className="mt-4 text-sm sm:text-base text-foreground-muted leading-relaxed">
            STRIM replaces arbitrary guessing with a verifiable, reproducible performance engineering pipeline.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {steps.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.step}
                className="relative flex flex-col rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:border-border-subtle hover:bg-surface-raised"
              >
                <div className="flex items-center justify-between pb-6 border-b border-border-subtle">
                  <span className="font-mono text-xs font-bold text-sand uppercase">
                    Step {item.step}
                  </span>
                  <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-foreground-subtle border border-border-subtle">
                    {item.badge}
                  </span>
                </div>

                <div className="my-6 flex size-12 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised">
                  <Icon className={`size-6 ${item.accent}`} />
                </div>

                <h3 className="text-lg font-semibold text-foreground font-heading">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-foreground-muted leading-relaxed flex-1">
                  {item.description}
                </p>

                <div className="mt-6 pt-4 border-t border-border-subtle/60 flex items-center gap-1.5 text-xs font-mono text-sand">
                  <span>Explore in console</span>
                  <ArrowRight className="size-3" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
