"use client";

import { motion } from "framer-motion";
import { Activity, ArrowRight, Check, Copy, Sparkles, Terminal, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";

export function FinalCtaTriptych() {
  const [copied, setCopied] = useState(false);

  function copySdk() {
    navigator.clipboard.writeText("bun add @strim/sdk");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="relative overflow-hidden pt-12 pb-24 sm:pt-16 sm:pb-32">
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Ambient Emerald Radial Glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/12 blur-[140px] dark:bg-brand/18" />

        {/* ── Shelf-Inspired Triptych Layout ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
          {/* Left Flanking Teaser Card */}
          <div className="hidden lg:flex lg:col-span-3 flex-col justify-between rounded-[28px] border border-border bg-card/60 p-6 backdrop-blur-md">
            <div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Activity className="size-4" />
              </span>
              <h4 className="mt-4 text-sm font-semibold text-foreground">500ms Resolution</h4>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Lock-free circular ring buffer captures high-frequency latency spikes before 1-minute averages mask them.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border font-mono text-[11px] text-brand">
              Atomic Ring Buffer
            </div>
          </div>

          {/* Centerpiece Squircle Card */}
          <div className="relative overflow-hidden rounded-[32px] border border-border bg-gradient-to-b from-card via-card/95 to-surface-muted/60 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-14 lg:col-span-6 flex flex-col items-center justify-center">
            {/* Subtle grid pattern */}
            <div className="bg-grid mask-vignette pointer-events-none absolute inset-0 opacity-30" />

            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-3.5 py-1 text-xs font-semibold text-brand-foreground dark:text-brand">
                <Sparkles className="size-3.5 text-brand" />
                <span>Ready in 60 Seconds</span>
              </div>

              <h2 className="mt-5 text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[44px] leading-[1.1]">
                Know your limit before your users find it.
              </h2>

              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                Deploy the 1-line SDK or launch an instant Smoke Probe. Zero scripts to maintain, zero credit card required.
              </p>

              {/* Install Bar */}
              <div
                onClick={copySdk}
                className="mx-auto mt-7 flex max-w-sm cursor-pointer items-center justify-between rounded-xl border border-border bg-surface-muted/80 px-4 py-2.5 font-mono text-xs text-foreground transition-colors hover:bg-surface-muted"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="size-3.5 text-brand" />
                  <span>bun add @strim/sdk</span>
                </div>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "rounded-xl bg-brand font-semibold text-brand-foreground hover:bg-brand-strong px-6 shadow-lg shadow-brand/20 transition-all"
                  )}
                >
                  <span>Launch console</span>
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/docs"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-xl px-5")}
                >
                  Read the docs
                </Link>
              </div>
            </div>
          </div>

          {/* Right Flanking Teaser Card */}
          <div className="hidden lg:flex lg:col-span-3 flex-col justify-between rounded-[28px] border border-border bg-card/60 p-6 backdrop-blur-md">
            <div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Zap className="size-4" />
              </span>
              <h4 className="mt-4 text-sm font-semibold text-foreground">&lt; 0.12ms Overhead</h4>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Asynchronous flushing with zero dynamic heap allocations on the hot execution path. Compatible with Bun and Node.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border font-mono text-[11px] text-brand">
              Zero-Allocation Path
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
