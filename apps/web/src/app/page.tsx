"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const { token, loading } = useSession();

  // Interactive simulation demo state on the hero
  const [trafficMultiplier, setTrafficMultiplier] = useState(2.0);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    // If user is already authenticated, allow them to view landing or jump straight to runtime
  }, [token, loading]);

  const simulatedP95 = cacheEnabled
    ? Math.round(145 * (1 + (trafficMultiplier - 1) * 0.15))
    : Math.round(380 * (1 + (trafficMultiplier - 1) * 0.65));

  const simulatedRps = Math.round(2400 * trafficMultiplier);
  const simulatedOriginRps = cacheEnabled ? Math.round(simulatedRps * 0.25) : simulatedRps;

  function copyCode() {
    navigator.clipboard.writeText(`npm install @strim/sdk\n\nimport { strim } from "@strim/sdk";\nstrim.init({\n  projectId: "checkout-svc",\n  environment: "production",\n  apiKey: process.env.STRIM_API_KEY\n});`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-brand-pink/20 selection:text-brand-pink">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-full bg-brand-pink flex items-center justify-center font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
              S
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              STRIM
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Platform Features
            </a>
            <a href="#simulations" className="hover:text-foreground transition-colors">
              What-If Simulator
            </a>
            <a href="#sdk" className="hover:text-foreground transition-colors">
              SDK & Integration
            </a>
            <a href="#architecture" className="hover:text-foreground transition-colors">
              Fail-Open Engine
            </a>
            <a
              href="http://localhost:8080/swagger"
              target="_blank"
              rel="noreferrer"
              className="hover:text-brand-pink transition-colors"
            >
              API Reference
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {token ? (
              <Link
                href="/runtime"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-9 rounded-full px-5 font-bold text-xs bg-[#0D0C22] text-white hover:bg-[#1E1D38] transition-all",
                )}
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-9 rounded-full px-4 text-xs font-semibold",
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-9 rounded-full px-5 font-bold text-xs bg-[#0D0C22] text-white hover:opacity-90 dark:bg-white dark:text-[#0D0C22]",
                  )}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Subtle background glow highlights */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-brand-pink/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-36 right-1/4 size-[400px] rounded-full bg-brand-lime/10 blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 bg-secondary border border-border text-xs font-semibold text-foreground shadow-2xs">
            <span className="size-2 rounded-full bg-brand-lime animate-pulse" />
            <span className="text-muted-foreground font-medium">Production-Grade Intelligence</span>
            <span className="text-border">|</span>
            <span className="text-brand-pink font-bold">Strim v1.0 Live</span>
          </div>

          <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl mx-auto leading-[1.08]">
            Know what a change will do{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-gold to-brand-lime">
              before production finds out.
            </span>
          </h1>

          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
            Eliminate 2 AM post-mortems. Test traffic surges with What-If simulations, walk dependency blast radius, and execute staged canary rollouts with automated 1-click rollback.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 rounded-full px-7 font-bold text-sm bg-[#0D0C22] text-white hover:bg-[#1E1D38] shadow-md transition-all",
              )}
            >
              Start Free Trial <ArrowRight className="size-4 ml-2" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 rounded-full px-6 font-semibold text-sm border-border bg-card hover:bg-secondary",
              )}
            >
              <Play className="size-3.5 mr-2 fill-current" /> Explore Live Demo
            </Link>
            <a
              href="http://localhost:8080/docs"
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "h-11 rounded-full px-5 font-semibold text-sm text-muted-foreground hover:text-foreground",
              )}
            >
              Scalar Interactive API
            </a>
          </div>

          {/* Social Proof Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-brand-lime" /> Zero Single Point of Failure
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-brand-lime" /> SDK Fail-Open Guaranteed
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-brand-lime" /> Source-Level PII Redaction
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-brand-lime" /> 365-Day Audit Floor
            </span>
          </div>

          {/* ── Interactive Cockpit Preview Card ─────────────────────────── */}
          <div className="pt-8 max-w-5xl mx-auto">
            <Card className="border border-border/90 bg-card/95 shadow-xl rounded-2xl overflow-hidden text-left backdrop-blur-xs">
              {/* Browser Window Bar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-secondary/50">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="size-3 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="size-3 rounded-full bg-green-500/80 inline-block" />
                  <span className="ml-2 text-xs font-mono text-muted-foreground">
                    https://app.strim.dev/runtime/checkout-production
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] text-brand-lime border-brand-lime/40 font-mono">
                    ● SSE TELEMETRY LIVE
                  </Badge>
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                    ENV: PRODUCTION
                  </Badge>
                </div>
              </div>

              {/* Cockpit Content */}
              <CardContent className="p-6 space-y-6">
                {/* Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Health Score</span>
                    <div className="text-3xl font-extrabold text-brand-lime flex items-baseline gap-1">
                      98 <span className="text-xs font-medium text-muted-foreground">/ 100</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">Explainable breakdown: Optimal</span>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Simulated Traffic</span>
                    <div className="text-3xl font-extrabold text-foreground">
                      {simulatedRps.toLocaleString()}{" "}
                      <span className="text-xs font-medium text-muted-foreground">RPS</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{trafficMultiplier}x Current Baseline</span>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Simulated P95 Latency</span>
                    <div className="text-3xl font-extrabold text-foreground">
                      {simulatedP95} <span className="text-xs font-medium text-muted-foreground">ms</span>
                    </div>
                    <span className={`text-[11px] font-semibold ${cacheEnabled ? "text-brand-lime" : "text-amber-500"}`}>
                      {cacheEnabled ? "↓ 62% via Edge Cache" : "↑ Origin Saturation"}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Origin Load</span>
                    <div className="text-3xl font-extrabold text-foreground">
                      {simulatedOriginRps.toLocaleString()}{" "}
                      <span className="text-xs font-medium text-muted-foreground">RPS</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {cacheEnabled ? "75% Edge Offload" : "100% Direct Hit"}
                    </span>
                  </div>
                </div>

                {/* Interactive Controls Bar */}
                <div className="p-4 rounded-xl bg-secondary/60 border border-border flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="space-y-1 w-full sm:w-64">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>Traffic Load Multiplier</span>
                        <span className="text-brand-pink font-bold">{trafficMultiplier.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.5"
                        value={trafficMultiplier}
                        onChange={(e) => setTrafficMultiplier(parseFloat(e.target.value))}
                        className="w-full accent-brand-pink cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={cacheEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCacheEnabled(!cacheEnabled)}
                        className={cn(
                          "rounded-full h-8 px-4 text-xs font-bold",
                          cacheEnabled
                            ? "bg-brand-pink text-white hover:bg-brand-pink/90"
                            : "border-border",
                        )}
                      >
                        Edge Cache: {cacheEnabled ? "ON (Recommended)" : "OFF"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="rounded-full px-3 py-1 font-semibold text-xs border-brand-lime/40 text-brand-lime bg-brand-lime/10">
                      CI MERGE GATE: PASS
                    </Badge>
                    <Link
                      href="/change-plans"
                      className={cn(
                        buttonVariants({ size: "sm" }),
                        "rounded-full h-8 px-4 font-bold text-xs bg-primary text-primary-foreground",
                      )}
                    >
                      Review Change Plan <ArrowRight className="size-3.5 ml-1" />
                    </Link>
                  </div>
                </div>

                {/* Canary Staged Stepper Preview */}
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Canary Rollout:</span>
                    <span className="font-mono text-muted-foreground">cplan_fast_checkout_v2</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-lime/20 text-brand-lime font-bold">10%</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-lime/20 text-brand-lime font-bold">25%</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-pink text-white font-bold animate-pulse">50% Active</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">100%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="destructive" size="sm" className="rounded-full h-7 px-3 text-[11px] font-bold">
                      <RotateCcw className="size-3 mr-1" /> 1-Click Rollback
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Core Platform Pillars Section ────────────────────────────── */}
      <section id="features" className="py-20 border-t border-border/60 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
              A Complete Platform for Controlled Runtime Change
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Everything engineering teams need to simulate, deploy, verify, and rollback changes across high-throughput distributed systems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 hover:border-brand-pink/50 transition-colors">
              <div className="size-10 rounded-full bg-brand-pink/15 text-brand-pink flex items-center justify-center">
                <Zap className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-bold">What-If Simulations Studio</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Test traffic surges, edge caching rules, and dependency latency without touching production. Compare baseline vs simulated P95 latency and origin RPS side-by-side.
              </p>
              <div className="pt-2 text-xs font-semibold text-brand-pink flex items-center gap-1">
                Explore Simulations <ArrowRight className="size-3" />
              </div>
            </Card>

            {/* Card 2 */}
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 hover:border-brand-lime/50 transition-colors">
              <div className="size-10 rounded-full bg-brand-lime/15 text-brand-lime flex items-center justify-center">
                <GitBranch className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-bold">Topology & Blast Radius</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Interactive React Flow canvas mapping service dependencies, Redis clusters, and PostgreSQL databases. Automatically highlights blast radius and upstream impact.
              </p>
              <div className="pt-2 text-xs font-semibold text-brand-lime flex items-center gap-1">
                Inspect Dependency Graph <ArrowRight className="size-3" />
              </div>
            </Card>

            {/* Card 3 */}
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 hover:border-brand-gold/50 transition-colors">
              <div className="size-10 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-bold">Canary Rollouts & Circuit Breakers</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                12-state change lifecycle with staged rollouts (10% → 25% → 50% → 100%). Automated guardrails trip instant rollback if error rates exceed 5% or latency spikes.
              </p>
              <div className="pt-2 text-xs font-semibold text-brand-gold flex items-center gap-1">
                View Rollout Stepper <ArrowRight className="size-3" />
              </div>
            </Card>

            {/* Card 4 */}
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 hover:border-purple-500/50 transition-colors">
              <div className="size-10 rounded-full bg-purple-500/15 text-purple-400 flex items-center justify-center">
                <Sparkles className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-bold">Grounded AI Copilot</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ask questions grounded in tenant-isolated telemetry. Includes automatic causality hedging (softens unqualified causal statements) and verified citations.
              </p>
              <div className="pt-2 text-xs font-semibold text-purple-400 flex items-center gap-1">
                Test AI Queries <ArrowRight className="size-3" />
              </div>
            </Card>

            {/* Card 5 */}
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 hover:border-cyan-500/50 transition-colors">
              <div className="size-10 rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                <Cpu className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-bold">Load Testing & Breaking Points</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Identify sustainable RPS, degradation onset, and critical failure RPS using production-derived traffic distributions. Audit HTTP 429 backpressure hygiene.
              </p>
              <div className="pt-2 text-xs font-semibold text-cyan-400 flex items-center gap-1">
                Run Breaking Point Stress <ArrowRight className="size-3" />
              </div>
            </Card>

            {/* Card 6 */}
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4 hover:border-emerald-500/50 transition-colors">
              <div className="size-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Database className="size-5" />
              </div>
              <h3 className="font-heading text-xl font-bold">Cache Intelligence & Policies</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Automated heuristics highlight hot, slow, stable GET endpoints ripe for edge caching. Detect runtime drift between active environments and policy contracts.
              </p>
              <div className="pt-2 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                Explore Cache Rules <ArrowRight className="size-3" />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SDK Code Quickstart ─────────────────────────────────────── */}
      <section id="sdk" className="py-20 border-t border-border/60">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="rounded-full px-3 py-1 font-semibold text-xs border-brand-pink/40 text-brand-pink">
              DEVELOPER EXPERIENCE
            </Badge>

            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
              3 Lines to Instrument Any Node or Next.js App
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed">
              The Strim SDK is built with a strict <strong>Fail-Open guarantee</strong>. If Strim is ever unreachable, your customer application continues operating normally with zero latency overhead or unhandled errors.
            </p>

            <ul className="space-y-2.5 text-xs text-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-brand-lime" />
                <span>Bounded in-memory ring buffer (500 items drop-oldest shedding)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-brand-lime" />
                <span>Source-level automatic redaction of Authorization, cookies, and tokens</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-brand-lime" />
                <span>Deterministic canary rollout evaluation in memory (`strim.config()`)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-brand-lime" />
                <span>Real-time config streaming with automatic disk cache fallback</span>
              </li>
            </ul>

            <div className="pt-2 flex items-center gap-3">
              <Link
                href="/keys"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "rounded-full h-9 px-5 font-bold text-xs bg-[#0D0C22] text-white dark:bg-white dark:text-[#0D0C22]",
                )}
              >
                Generate API Key
              </Link>
              <a
                href="http://localhost:8080/swagger"
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-full h-9 px-4 text-xs font-semibold",
                )}
              >
                OpenAPI 3.1 Contract
              </a>
            </div>
          </div>

          {/* Terminal / Code Block */}
          <div className="rounded-2xl border border-border/80 bg-[#0E0D1E] p-5 shadow-xl font-mono text-xs text-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#232242]">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-brand-pink" />
                <span className="text-[#8E8D9F] text-[11px]">quickstart.ts</span>
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="text-[11px] px-2.5 py-1 rounded-full bg-[#1E1D38] hover:bg-[#2A294A] text-brand-pink transition-colors font-sans font-semibold"
              >
                {copiedCode ? "Copied!" : "Copy Code"}
              </button>
            </div>

            <pre className="overflow-x-auto text-[11px] text-gray-300 leading-relaxed">
{`// 1. Install SDK
npm install @strim/sdk

// 2. Initialize in your application entrypoint
import { strim } from "@strim/sdk";

strim.init({
  projectId: "checkout-service",
  environment: "production",
  apiKey: process.env.STRIM_API_KEY,
  ingestUrl: "http://localhost:8080",
});

// 3. Read versioned runtime configs with canary rollout support
const timeout = strim.config("checkout.timeout", 3000, {
  bucketKey: req.user.id // Deterministic canary bucket
});`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-border/80 bg-background py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-full bg-brand-pink flex items-center justify-center font-bold text-white text-xs">
              S
            </div>
            <span className="font-heading text-sm font-bold tracking-tight text-foreground">
              STRIM PLATFORM
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <Link href="/runtime" className="hover:text-foreground transition-colors">
              Runtime Model
            </Link>
            <Link href="/change-plans" className="hover:text-foreground transition-colors">
              Change Plans
            </Link>
            <Link href="/simulations" className="hover:text-foreground transition-colors">
              Simulations
            </Link>
            <a href="http://localhost:8080/docs" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
              API Docs
            </a>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
          </div>

          <div className="text-xs text-muted-foreground">
            © 2026 Strim Labs Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
