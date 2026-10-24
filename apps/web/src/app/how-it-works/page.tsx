"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Zap,
  Cpu,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  GitBranch,
  Terminal,
  Gauge,
  Clock,
} from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-brand selection:text-white">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-40 bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="size-8 rounded-lg bg-brand text-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
                <Zap className="size-4" />
              </div>
              <span className="font-heading font-bold text-sm tracking-tight text-foreground">
                STRIM
              </span>
            </Link>
            <span className="text-[11px] font-mono text-muted-foreground hidden md:inline-block border-l border-border/60 pl-3">
              How It Works
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Overview
            </Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">
              Documentation
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/login">
              <Button
                size="sm"
                className="text-xs h-8 px-3.5 bg-brand hover:bg-brand-strong text-white font-medium shadow-xs"
              >
                Open Console
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16 space-y-16">
        {/* Title */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand/30 bg-brand-subtle text-brand text-xs font-medium">
            <Cpu className="size-3.5" />
            Engine Internals & Architecture
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-foreground">
            How STRIM Measures API Capacity
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A look into the native Bun execution engine, 500ms streaming telemetry pipeline, and
            algorithmic saturation knee detection.
          </p>
        </div>

        {/* 4 Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pillar 1 */}
          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-5 pb-2">
              <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center mb-2">
                <Cpu className="size-4" />
              </div>
              <CardTitle className="text-base font-heading font-bold text-foreground">
                1. Multi-Worker Bun Runtime
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                Unlike bloated JVM or Python-based load generation tools, STRIM leverages Bun's native
                C++ HTTP networking stack.
              </p>
              <p>
                Worker pools spawn lightweight asynchronous event loops capable of saturating 10,000+
                concurrent HTTP connections with sub-millisecond timer resolution and minimal memory
                overhead.
              </p>
            </CardContent>
          </Card>

          {/* Pillar 2 */}
          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-5 pb-2">
              <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center mb-2">
                <Activity className="size-4" />
              </div>
              <CardTitle className="text-base font-heading font-bold text-foreground">
                2. 500ms Telemetry Ring Buffer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                Instead of hammering a database with millions of raw request timestamps, workers record
                metrics into lock-free in-memory ring buffers.
              </p>
              <p>
                Every 500ms, the aggregator computes accurate percentiles (P50, P95, P99), instantaneous
                RPS, and HTTP status codes, broadcasting directly to your browser via Server-Sent Events
                (SSE).
              </p>
            </CardContent>
          </Card>

          {/* Pillar 3 */}
          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-5 pb-2">
              <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center mb-2">
                <Gauge className="size-4" />
              </div>
              <CardTitle className="text-base font-heading font-bold text-foreground">
                3. Algorithmic Saturation Knee Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                Traditional tools simply report whether a test passed or failed. STRIM analyzes the
                derivative of the latency vs. concurrency curve:
              </p>
              <div className="p-2 rounded bg-secondary font-mono text-[11px] text-foreground">
                knee_condition = (d²Latency/dConcurrency² &gt; threshold) &amp;&amp; (RPS_growth &lt; 0.1)
              </div>
              <p>
                This precisely separates your API's Nominal Safe Band from the Saturation Knee and
                Critical Failure Point.
              </p>
            </CardContent>
          </Card>

          {/* Pillar 4 */}
          <Card className="border-border/60 shadow-sm bg-card">
            <CardHeader className="p-5 pb-2">
              <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center mb-2">
                <GitBranch className="size-4" />
              </div>
              <CardTitle className="text-base font-heading font-bold text-foreground">
                4. Continuous Regression Gate
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
              <p>
                Integrate STRIM into GitHub Actions or GitLab CI. When pull requests are created, STRIM
                executes an identical load profile against the staging endpoint.
              </p>
              <p>
                If candidate P95 degrades beyond your configured threshold (e.g. &gt;10%), the gate
                immediately fails the build before degraded code touches production users.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Responsible Testing & Safety */}
        <div className="p-6 rounded-2xl bg-secondary/30 border border-border/60 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-brand" />
            <h3 className="font-heading font-bold text-sm text-foreground">
              Safety Rails & SSRF Protection
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All target endpoints are validated prior to execution to prevent Server-Side Request Forgery
            (SSRF) against internal metadata services or loopback interfaces. Load tests include instant
            cancellation switches that terminate all outbound sockets within 200 milliseconds.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 pt-4 border-t border-border/60">
          <h2 className="text-xl font-heading font-bold text-foreground">
            Ready to benchmark your endpoints?
          </h2>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login">
              <Button className="h-9 px-4 text-xs font-semibold bg-brand hover:bg-brand-strong text-white rounded-lg shadow-sm">
                Launch Load Runner
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" className="h-9 px-4 text-xs font-medium rounded-lg">
                Read Documentation
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card py-6 mt-16 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span>&copy; {new Date().getFullYear()} Strim Labs.</span>
          <Link href="/" className="hover:text-foreground">Back to Overview</Link>
        </div>
      </footer>
    </div>
  );
}
