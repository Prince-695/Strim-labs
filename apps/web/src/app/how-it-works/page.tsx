import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Cpu, LineChart, ShieldCheck, Zap } from "lucide-react";
import { Reveal } from "@/components/fx/reveal";
import { EngineFlowchart } from "@/components/marketing/engine-flowchart";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { FinalCta, SectionHeading } from "@/components/marketing/sections";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How it works — STRIM Labs",
  description: "How the STRIM Continuous Observability & Saturation Engine works: @strim/sdk ingestion, 500 ms in-memory ring buffer, real-time telemetry, and automated 7-day breakpoint saturation.",
};

const PILLARS = [
  {
    icon: Zap,
    title: "1-Line Zero-Config SDK",
    body: "Attach @strim/sdk to your server middleware. Routes, methods, and timing are auto-discovered without writing or maintaining complex test suites.",
  },
  {
    icon: Cpu,
    title: "500 ms In-Memory Ring Buffer",
    body: "Telemetry is aggregated in a fixed-size circular buffer. Zero blocking database roundtrips during execution, maintaining sub-0.15ms application overhead.",
  },
  {
    icon: LineChart,
    title: "Automated 7-Day Saturation Ramp",
    body: "Weekly scheduled capacity runs simulate realistic production surges using Bun multi-worker runners to pinpoint breaking limits safely.",
  },
  {
    icon: ShieldCheck,
    title: "Algorithmic Capacity Knee",
    body: "Inflection analysis mathematically calculates the boundary between the Safe Band, Saturation Knee, and Breaking Cliff to prevent production outages.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="pt-16">
        {/* Page Hero */}
        <section className="relative overflow-hidden border-b border-border bg-background text-foreground">
          <div className="bg-grid mask-fade-b pointer-events-none absolute inset-0 opacity-40 dark:opacity-30" />
          <div className="pointer-events-none absolute -left-20 top-12 size-[420px] rounded-full bg-brand/12 blur-[120px]" />

          <div className="relative mx-auto max-w-[1200px] px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-3 py-1 text-xs font-semibold text-brand">
              Under the Hood
            </span>
            <h1 className="mt-4 max-w-3xl text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[56px] text-foreground">
              What happens between “Launch” and your answer
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
              STRIM combines zero-overhead production observability with an automated 7-day saturation ramp. Here is how the whole engine processes data end-to-end.
            </p>
          </div>
        </section>

        {/* Interactive Engine Flowchart */}
        <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8">
          <Reveal>
            <EngineFlowchart />
          </Reveal>
        </section>

        {/* Four Architectural Pillars */}
        <section className="border-y border-border bg-surface-muted/50">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8">
            <SectionHeading
              title="Four architectural pillars"
              body="Engineered for production safety, sub-millisecond precision, and actionable capacity answers."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {PILLARS.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.08}>
                  <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <span className="grid size-10 place-items-center rounded-lg border border-brand/20 bg-brand-subtle text-brand dark:bg-brand/10">
                      <p.icon className="size-5 text-brand" />
                    </span>
                    <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-foreground">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Observed vs Inferred Capacity Signals */}
        <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8">
          <SectionHeading
            title="Measured reality vs algorithmic inference"
            body="STRIM distinguishes direct empirical telemetry from derived capacity hypotheses."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-brand/40 bg-brand-subtle/40 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-success-text font-semibold">
                <CheckCircle2 className="size-4 text-brand" />
                <h3 className="text-[17px] tracking-tight">Directly Observed Telemetry</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Delivered throughput, P50/P95/P99 latency percentiles, HTTP status distributions, and worker socket states are measured directly from live request traffic. No synthetic assumptions.
              </p>
            </div>
            <div className="rounded-2xl border border-warning/40 bg-warning-subtle/40 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-warning-text font-semibold">
                <CheckCircle2 className="size-4 text-warning" />
                <h3 className="text-[17px] tracking-tight">Algorithmic Capacity Knee</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The saturation knee and breaking cliff are mathematical conclusions derived from latency curvature. Light runs explicitly label results as "insufficient evidence" rather than guessing.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Launch your console <ArrowRight className="size-4" />
            </Link>
            <Link href="/docs" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Read SDK documentation
            </Link>
          </div>
        </section>

        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
