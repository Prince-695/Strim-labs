"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap,
  BookOpen,
  ArrowRight,
  Terminal,
  Play,
  Gauge,
  Layers,
  GitBranch,
  ShieldAlert,
  Copy,
  Check,
  Code2,
} from "lucide-react";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<
    "quickstart" | "profiles" | "metrics" | "cicd"
  >("quickstart");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const curlExample = `curl -X POST https://api.strim.dev/v1/load-tests \\
  -H "Authorization: Bearer <YOUR_API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "proj_12345",
    "name": "Release Benchmark",
    "profile": "RAMP_UP",
    "concurrency": 50,
    "durationSec": 30
  }'`;

  const githubActionsYaml = `name: STRIM Regression Gate
on: [pull_request]

jobs:
  performance-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Run STRIM Load Test
        run: |
          RESPONSE=$(curl -s -X POST https://api.strim.dev/v1/load-tests \\
            -H "Authorization: Bearer \${{ secrets.STRIM_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "projectId": "\${{ secrets.STRIM_PROJECT_ID }}",
              "profile": "RAMP_UP",
              "concurrency": 50,
              "durationSec": 30
            }')
          echo "Test response: $RESPONSE"`;

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
              Documentation
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Overview
            </Link>
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
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

      {/* Docs Body with Navigation Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-56 shrink-0 space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 block mb-2">
            Guides & Reference
          </span>

          <button
            type="button"
            onClick={() => setActiveSection("quickstart")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
              activeSection === "quickstart"
                ? "bg-brand-subtle text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Play className="size-3.5 text-brand" />
            Quickstart (60s)
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("profiles")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
              activeSection === "profiles"
                ? "bg-brand-subtle text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5 text-brand" />
            4 Load Presets
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("metrics")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
              activeSection === "metrics"
                ? "bg-brand-subtle text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Gauge className="size-3.5 text-brand" />
            Capacity & Telemetry
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("cicd")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
              activeSection === "cicd"
                ? "bg-brand-subtle text-foreground font-semibold"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <GitBranch className="size-3.5 text-brand" />
            CI/CD Gate Integration
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 max-w-3xl space-y-8">
          {activeSection === "quickstart" && (
            <div className="space-y-6">
              <div>
                <Badge variant="outline" className="text-[10px] uppercase font-mono mb-2 border-brand/40 text-brand">
                  Getting Started
                </Badge>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  First Benchmark in 60 Seconds
                </h1>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Learn how to register an endpoint and execute your first load test against your target API.
                </p>
              </div>

              <div className="space-y-4 text-xs text-foreground leading-relaxed">
                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <h3 className="font-heading font-semibold text-sm">Step 1: Register Target API</h3>
                  <p className="text-muted-foreground">
                    Click <strong>+ Add Target</strong> in the console sidebar. Enter your endpoint URL (e.g. <code>https://api.example.com/v1/health</code>) and select the HTTP method. You can also click <em>Use Local Demo API</em> to test immediately without configuring your own servers.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <h3 className="font-heading font-semibold text-sm">Step 2: Select a Preset in Load Runner</h3>
                  <p className="text-muted-foreground">
                    Navigate to <strong>Load Runner</strong>. Click one of the 4 canonical presets (e.g. <em>Smoke Probe</em> for 10 VUs / 10s, or <em>Capacity Ramp</em> for 50 VUs / 30s).
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <h3 className="font-heading font-semibold text-sm">Step 3: Monitor Live Cockpit Telemetry</h3>
                  <p className="text-muted-foreground">
                    Click <strong>Launch Test Run</strong>. Telemetry dials (Throughput RPS, P95 Latency, Active VUs) update every 500ms via Server-Sent Events. If the target struggles, click <strong>Abort Test</strong> at any time for sub-200ms shutdown.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "profiles" && (
            <div className="space-y-6">
              <div>
                <Badge variant="outline" className="text-[10px] uppercase font-mono mb-2 border-brand/40 text-brand">
                  Load Profiles
                </Badge>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  The 4 Canonical Benchmark Presets
                </h1>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Pre-configured traffic shapes designed to answer specific engineering questions without configuration fatigue.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-sm text-foreground">1. Smoke Probe</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-brand font-semibold">
                      10 VUs · 10s · Sustained
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Basic health and latency sanity check. Verifies that authorization tokens, JSON serialization, and database connection handshakes function correctly under minimal concurrency.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-sm text-foreground">2. Capacity Ramp</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-brand font-semibold">
                      50 VUs · 30s · Ramp-Up
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Smooth linear concurrency increase. Identifies the exact <strong>Saturation Knee</strong> where tail latency shifts from sub-50ms linear performance into exponential queueing delay.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-sm text-foreground">3. Spike Surge</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-brand font-semibold">
                      150 VUs · 15s · Instant Burst
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Simulates flash traffic surges (e.g. push notification delivery, marketing drops). Measures how rapidly worker pools and database pools absorb incoming bursts before dropping requests.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-sm text-foreground">4. Breaking Point Hunt</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-brand font-semibold">
                      300 VUs · 45s · Aggressive Ramp
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    High-intensity concurrency ramp to failure. Discovers your absolute failure ceiling and whether the service fails safely with HTTP 429 rate limits or crashes with connection timeouts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "metrics" && (
            <div className="space-y-6">
              <div>
                <Badge variant="outline" className="text-[10px] uppercase font-mono mb-2 border-brand/40 text-brand">
                  Telemetry & Capacity
                </Badge>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  Mathematical Metrics & Saturation Knee
                </h1>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  How STRIM computes percentiles and identifies breaking points empirically.
                </p>
              </div>

              <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <h3 className="font-heading font-semibold text-sm text-foreground">P95 Tail Latency</h3>
                  <p>
                    Averages hide catastrophic slowdowns. STRIM calculates the 95th percentile of response durations across every 500ms sliding window: 95% of users experienced response times at or below this value.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <h3 className="font-heading font-semibold text-sm text-foreground">The Saturation Knee Point</h3>
                  <p>
                    The concurrency level at which adding more concurrent requests ceases to increase throughput (RPS), and instead solely inflates queueing time. This marks your service's highest efficient capacity ceiling.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card space-y-2">
                  <h3 className="font-heading font-semibold text-sm text-foreground">Evidence-Based Root-Cause Analysis</h3>
                  <p>
                    Rather than subjective guesses, STRIM combines error rate triggers, HTTP status codes (429 vs 502 vs 504), and throughput stagnation to output concrete, verified facts and qualified engineering hypotheses.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "cicd" && (
            <div className="space-y-6">
              <div>
                <Badge variant="outline" className="text-[10px] uppercase font-mono mb-2 border-brand/40 text-brand">
                  Continuous Integration
                </Badge>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  Automating Regression Gates in CI/CD
                </h1>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Block regressive commits automatically in GitHub Actions and GitLab CI.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">GitHub Actions Workflow</span>
                    <button
                      type="button"
                      onClick={() => copy(githubActionsYaml, "yaml")}
                      className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {copiedCode === "yaml" ? <Check className="size-3 text-brand" /> : <Copy className="size-3" />}
                      {copiedCode === "yaml" ? "Copied" : "Copy YAML"}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-secondary/80 border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto">
                    {githubActionsYaml}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">cURL API Trigger</span>
                    <button
                      type="button"
                      onClick={() => copy(curlExample, "curl")}
                      className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {copiedCode === "curl" ? <Check className="size-3 text-brand" /> : <Copy className="size-3" />}
                      {copiedCode === "curl" ? "Copied" : "Copy cURL"}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-secondary/80 border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto">
                    {curlExample}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card py-6 mt-16 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span>&copy; {new Date().getFullYear()} Strim Labs Documentation.</span>
          <Link href="/" className="hover:text-foreground">Back to Overview</Link>
        </div>
      </footer>
    </div>
  );
}
