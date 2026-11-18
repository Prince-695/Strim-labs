"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Cloud, Terminal, Check } from "lucide-react"

export function CTA() {
  return (
    <section
      id="get-started"
      className="scroll-mt-20 border-t border-border px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        {/* Section Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3.5 py-1 font-mono text-xs text-foreground-muted">
            <span className="text-brand">[07]</span>
            <span>GET STARTED</span>
          </div>
          <h2 className="font-mono text-3xl font-normal tracking-[-0.03em] text-foreground sm:text-4xl">
            Ready to find your server&apos;s breaking point?
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-sans text-base leading-relaxed text-sand">
            Simulate realistic user traffic, uncover hidden bottlenecks, and
            measure real response times before your users ever notice an issue.
          </p>
        </div>

        <div className="space-y-3 font-mono text-xs text-sand">
          <div className="flex items-center gap-2.5">
            <Check className="size-4 text-emerald-400" />
            <span>Simulate up to 500,000 concurrent users</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Check className="size-4 text-emerald-400" />
            <span>Live sub-second performance dashboard</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Check className="size-4 text-emerald-400" />
            <span>Automated breaking point and bottleneck isolation</span>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-brand px-8 py-3.5 font-mono text-xs font-bold tracking-wider text-white uppercase shadow-lg shadow-brand/20 transition-colors hover:bg-brand-hover"
          >
            <span>Start Free Load Test</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
