"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Cloud, Terminal, Check } from "lucide-react"

export function CTA() {
  return (
    <section id="get-started" className="scroll-mt-20 border-t border-border px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl flex flex-col items-center">
        {/* Section Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3.5 py-1 font-mono text-xs text-foreground-muted mb-4">
            <span className="text-brand">[07]</span>
            <span>GET STARTED</span>
          </div>
          <h2 className="font-mono text-3xl sm:text-4xl font-normal text-foreground tracking-[-0.03em]">
            Ready to find your server&apos;s breaking point?
          </h2>
          <p className="mt-3 font-sans text-base text-sand max-w-xl mx-auto leading-relaxed">
            Simulate realistic user traffic, uncover hidden bottlenecks, and measure real response times before your users ever notice an issue.
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

        <div className="mt-8 pt-6 border-t border-border">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover py-3.5 px-8 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors shadow-lg shadow-brand/20"
          >
            <span>Start Free Load Test</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
