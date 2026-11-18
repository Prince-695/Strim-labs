"use client"

import * as React from "react"
import { Activity, Cpu, ShieldCheck, Zap, Gauge, Terminal, Radio } from "lucide-react"

const TICKER_ITEMS = [
  { text: "SIMULATE 500,000+ USERS", icon: Cpu, accent: "text-brand" },
  { text: "REAL-TIME TRAFFIC MONITORING", icon: Radio, accent: "text-emerald-400" },
  { text: "AUTOMATIC ENDPOINT DISCOVERY", icon: Activity, accent: "text-brand" },
  { text: "TRUE LATENCY MEASUREMENTS", icon: ShieldCheck, accent: "text-emerald-400" },
  { text: "AUTOMATED BREAKING POINT DETECTION", icon: Gauge, accent: "text-amber-400" },
  { text: "PREVENT PRODUCTION DOWNTIME", icon: Zap, accent: "text-brand" },
  { text: "MULTI-REGION LOAD TESTING", icon: Terminal, accent: "text-sand" },
  { text: "ZERO CONFIGURATION REQUIRED", icon: ShieldCheck, accent: "text-emerald-400" },
]

export function MarqueeTicker() {
  return (
    <div className="relative w-full border-y border-border-subtle bg-surface py-3.5 overflow-hidden select-none">
      {/* Corner Crosshairs */}
      <span className="absolute left-2 top-1 font-mono text-[10px] text-sand/30 pointer-events-none">+</span>
      <span className="absolute right-2 top-1 font-mono text-[10px] text-sand/30 pointer-events-none">+</span>

      {/* Infinite scrolling ribbon */}
      <div className="flex w-max animate-marquee-horizontal">
        {/* First copy */}
        <div className="flex items-center gap-8 shrink-0 pr-8">
          {TICKER_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={`ticker-1-${idx}`} className="flex items-center gap-3 font-mono text-xs tracking-wider uppercase text-foreground-muted">
                <Icon className={`size-3.5 ${item.accent}`} />
                <span className="font-light text-foreground">{item.text}</span>
                <span className="text-border font-light">✦</span>
              </div>
            )
          })}
        </div>

        {/* Second identical copy for seamless loop */}
        <div className="flex items-center gap-8 shrink-0 pr-8" aria-hidden="true">
          {TICKER_ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={`ticker-2-${idx}`} className="flex items-center gap-3 font-mono text-xs tracking-wider uppercase text-foreground-muted">
                <Icon className={`size-3.5 ${item.accent}`} />
                <span className="font-light text-foreground">{item.text}</span>
                <span className="text-border font-light">✦</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Left/Right Edge fade gradients */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  )
}
