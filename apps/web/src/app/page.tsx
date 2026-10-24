"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Zap,
  Play,
  ArrowRight,
  ArrowUpRight,
  ShieldAlert,
  Gauge,
  Clock,
  ArrowLeftRight,
  CheckCircle2,
  Cpu,
  Layers,
  Terminal,
  Activity,
  Code2,
  Lock,
  GitPullRequest,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const DEMO_PRESETS_DATA: Record<string, { t: string; rps: number; p95: number }[]> = {
  smoke: [
    { t: "0s", rps: 0, p95: 22 },
    { t: "2s", rps: 45, p95: 24 },
    { t: "4s", rps: 98, p95: 28 },
    { t: "6s", rps: 100, p95: 29 },
    { t: "8s", rps: 102, p95: 30 },
    { t: "10s", rps: 100, p95: 31 },
  ],
  ramp: [
    { t: "0s", rps: 0, p95: 20 },
    { t: "5s", rps: 120, p95: 25 },
    { t: "10s", rps: 280, p95: 35 },
    { t: "15s", rps: 480, p95: 48 },
    { t: "20s", rps: 650, p95: 75 },
    { t: "25s", rps: 820, p95: 180 },
    { t: "30s", rps: 940, p95: 450 },
  ],
  spike: [
    { t: "0s", rps: 50, p95: 24 },
    { t: "3s", rps: 50, p95: 25 },
    { t: "5s", rps: 1200, p95: 140 },
    { t: "8s", rps: 1450, p95: 380 },
    { t: "11s", rps: 1300, p95: 290 },
    { t: "15s", rps: 100, p95: 32 },
  ],
};

export default function HomePage() {
  const { token, loading } = useSession();
  const [activePreset, setActivePreset] = useState<"smoke" | "ramp" | "spike">("ramp");

  // If user is authenticated, render the full authenticated dashboard console inside AppShell
  if (!loading && token) {
    return (
      <AppShell>
        <DashboardView />
      </AppShell>
    );
  }

  // Public Marketing Landing Page for unauthenticated visitors
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-brand selection:text-white">
      {/* Top Marketing Navigation */}
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
              API Load & Capacity Engine
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">
              Documentation
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs h-8 px-3 font-medium">
                Sign In
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="text-xs h-8 px-3.5 bg-brand hover:bg-brand-strong text-white font-medium shadow-xs"
              >
                Launch Console
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Marketing Hero */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20 space-y-20">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand/30 bg-brand-subtle text-brand text-xs font-medium">
            <span className="size-1.5 rounded-full bg-brand animate-pulse" />
            Zero-Theatre Real-Time Telemetry
          </div>

          <h1 className="text-3xl sm:text-5xl font-heading font-bold tracking-tight text-foreground leading-[1.15]">
            Find your API breaking point{" "}
            <span className="text-brand">before production does.</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Multi-VU HTTP load generation with automated saturation knee detection, empirical root-cause
            diagnostics, and live regression gates for your CI/CD pipeline.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/login">
              <Button
                size="lg"
                className="h-10 px-5 text-xs font-semibold bg-brand hover:bg-brand-strong text-white rounded-lg shadow-sm gap-2"
              >
                Start Free Load Test
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button
                variant="outline"
                size="lg"
                className="h-10 px-5 text-xs font-semibold rounded-lg border-border/80 gap-2"
              >
                Explore Engine Architecture
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 text-[11px] text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-brand" /> 4 Canonical Presets
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-brand" /> 500ms SSE Stream
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-brand" /> Instant Abort Safety
            </span>
          </div>
        </div>

        {/* Live Interactive Telemetry Preview */}
        <Card className="border-border/60 shadow-lg bg-card overflow-hidden max-w-5xl mx-auto">
          <div className="p-4 bg-secondary/40 border-b border-border/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-foreground">
                LIVE DEMO BENCHMARK:
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                GET https://api.demo.strim.dev/v1/checkout
              </span>
            </div>

            {/* Preset Toggle */}
            <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setActivePreset("smoke")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activePreset === "smoke"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Smoke (10 VU)
              </button>
              <button
                type="button"
                onClick={() => setActivePreset("ramp")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activePreset === "ramp"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Capacity Ramp (50 VU)
              </button>
              <button
                type="button"
                onClick={() => setActivePreset("spike")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activePreset === "spike"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Spike Surge (150 VU)
              </button>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* 3 Metric Summary Dials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg bg-secondary/50 border border-border/60">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                  Peak Throughput
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-heading font-black text-foreground font-mono">
                    {Math.max(...DEMO_PRESETS_DATA[activePreset].map((d) => d.rps))}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">RPS</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-secondary/50 border border-border/60">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                  Tail Latency (P95)
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-heading font-black text-amber-500 font-mono">
                    {Math.max(...DEMO_PRESETS_DATA[activePreset].map((d) => d.p95))}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">ms</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-secondary/50 border border-border/60">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                  Capacity Verdict
                </span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Safe Band Verified (&le; 650 RPS)
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Graph */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DEMO_PRESETS_DATA[activePreset]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#00C968"
                    fontSize={11}
                    tickFormatter={(v) => `${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#F59E0B"
                    fontSize={11}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="rps"
                    stroke="#00C968"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#00C968" }}
                    name="Throughput (RPS)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="p95"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#F59E0B" }}
                    name="P95 Latency (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 3-Zone Visual Capacity Spectrum Explainer */}
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">
              The 3-Zone Capacity Spectrum
            </h2>
            <p className="text-xs text-muted-foreground max-w-lg mx-auto">
              How STRIM objectively classifies your API performance without relying on synthetic guesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <h3 className="font-heading font-bold text-sm text-foreground">
                  1. Nominal Safe Band
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Linear throughput growth with stable P95 latency (&lt; 50ms) and zero HTTP error rates.
                Your system effortlessly handles this concurrency.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500" />
                <h3 className="font-heading font-bold text-sm text-foreground">
                  2. Saturation Knee
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Throughput reaches its inflection point while P95 tail latency increases exponentially.
                Signals queue saturation or connection pool exhaustion.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rose-500" />
                <h3 className="font-heading font-bold text-sm text-foreground">
                  3. Breaking Cliff
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Throughput collapses as HTTP 429 rate limits or 5xx server errors breach your
                reliability threshold. The absolute ceiling of your service.
              </p>
            </div>
          </div>
        </div>

        {/* 3-Step Workflow Section */}
        <div className="space-y-8 max-w-5xl mx-auto pt-8 border-t border-border/60">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-heading font-bold text-foreground">
              From URL to Production Gate in 3 Steps
            </h2>
            <p className="text-xs text-muted-foreground">
              Everything you need to benchmark and guard API performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-card border border-border/60 space-y-3">
              <div className="size-8 rounded-lg bg-secondary text-brand flex items-center justify-center font-mono font-bold text-sm">
                01
              </div>
              <h3 className="font-heading font-bold text-sm text-foreground">Register Target API</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Provide your endpoint URL, method, and optional Bearer token. Use our 1-click built-in
                demo API to test immediately with zero infrastructure.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border/60 space-y-3">
              <div className="size-8 rounded-lg bg-secondary text-brand flex items-center justify-center font-mono font-bold text-sm">
                02
              </div>
              <h3 className="font-heading font-bold text-sm text-foreground">
                Run 4 Canonical Presets
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose from Smoke Probe, Capacity Ramp, Spike Surge, or Breaking Point Hunt. Watch
                live SSE telemetry stream every 500ms with instant abort protection.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border/60 space-y-3">
              <div className="size-8 rounded-lg bg-secondary text-brand flex items-center justify-center font-mono font-bold text-sm">
                03
              </div>
              <h3 className="font-heading font-bold text-sm text-foreground">
                Automate CI/CD Gate
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Compare pull request benchmark runs in our Comparison Studio. Configure live latency
                and error tolerances to block regressive code merges automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Security & Reliability Callout */}
        <div className="p-6 rounded-2xl bg-secondary/40 border border-border/60 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-foreground font-semibold text-sm">
              <Lock className="size-4 text-brand" />
              Engineered for Responsible Testing
            </div>
            <p className="text-xs text-muted-foreground max-w-lg">
              SSRF validation guards internal networks. Tokens encrypted at rest with AES-256-GCM.
              Instant cancellation aborts traffic in &lt; 200ms.
            </p>
          </div>
          <Link href="/login" className="shrink-0">
            <Button className="text-xs h-9 px-4 bg-brand hover:bg-brand-strong text-white font-medium rounded-lg">
              Get Started Now
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card py-8 mt-16 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded-md bg-brand text-white flex items-center justify-center">
              <Zap className="size-3" />
            </div>
            <span className="font-heading font-bold text-foreground">STRIM Labs</span>
            <span>&copy; {new Date().getFullYear()} Strim Labs. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">
              Documentation
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
