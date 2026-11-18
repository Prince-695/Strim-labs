"use client"

import * as React from "react"
import { Terminal, Copy, Check, CheckCircle2 } from "lucide-react"

type InstallTab = "shell" | "docker" | "ci" | "gosdk"

export function InstallWidget() {
  const [activeTab, setActiveTab] = React.useState<InstallTab>("shell")
  const [copied, setCopied] = React.useState(false)

  const SNIPPETS: Record<InstallTab, string> = {
    shell: `# Install the STRIM CLI
curl -sSL https://strim.dev/install.sh | bash

# Run your first load test against your server
strim test \\
  --target https://api.myapp.com \\
  --max-rps 40000 \\
  --duration 60s`,

    docker: `# Run a load test using Docker
docker run --rm -it \\
  -e STRIM_API_KEY="strim_live_..." \\
  ghcr.io/strim-labs/runner:latest \\
  --target https://api.myapp.com \\
  --vus 5000 \\
  --duration 120s`,

    ci: `# .github/workflows/performance-test.yml
name: Performance Check
on: [pull_request]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: strim-labs/action-gate@v1
        with:
          target: "https://staging.myapp.com"
          max-rps: 25000`,

    gosdk: `package main

import (
    "context"
    "github.com/strim-labs/runner-sdk-go"
)

func main() {
    runner := strim.NewRunner(strim.Config{
        Target:   "https://api.myapp.com",
        MaxRPS:   50000,
        Duration: "180s",
    })
    
    // Executes the test and streams live results
    _ = runner.Execute(context.Background())
}`,
  }

  const copySnippet = () => {
    navigator.clipboard.writeText(SNIPPETS[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="quickstart" className="scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Section Header */}
        <div className="flex flex-col items-start gap-3 mb-10">
          <div className="flex items-center gap-2 font-mono text-xs text-foreground-subtle uppercase tracking-wider">
            <span className="text-brand">[06]</span>
            <span>QUICKSTART</span>
          </div>
          <h2 className="font-mono text-2xl sm:text-3xl font-light text-foreground">
            Start testing in 60 seconds.
          </h2>
          <p className="font-sans text-sm text-sand">
            No complex setups or heavy dependencies. Install with a single command, run with Docker, or add automated performance checks directly to your CI/CD pipeline.
          </p>
        </div>

        {/* Multi-Tab Terminal Card */}
        <div className="rounded-xl border border-border-subtle bg-surface-raised overflow-hidden shadow-2xl">
          {/* Terminal Tabs Bar */}
          <div className="flex items-center justify-between border-b border-border-subtle bg-background px-4 py-2">
            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                onClick={() => setActiveTab("shell")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "shell"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Shell CLI
              </button>
              <button
                onClick={() => setActiveTab("docker")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "docker"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Docker
              </button>
              <button
                onClick={() => setActiveTab("ci")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "ci"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                GitHub Actions
              </button>
              <button
                onClick={() => setActiveTab("gosdk")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  activeTab === "gosdk"
                    ? "bg-surface-hover text-foreground border border-border"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Go SDK
              </button>
            </div>

            <button
              onClick={copySnippet}
              className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-raised px-2.5 py-1 font-mono text-xs text-sand hover:border-border transition-colors"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-success" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Terminal Body */}
          <div className="p-5 font-mono text-xs text-sand overflow-x-auto bg-surface-sunken">
            <pre className="leading-relaxed">
              <code>{SNIPPETS[activeTab]}</code>
            </pre>
          </div>

          {/* Terminal Footer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-border bg-surface px-4 py-2.5 font-mono text-[11px] text-foreground-subtle gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-success" />
              <span>Free and open source under Apache 2.0</span>
            </div>
            <div className="text-sand">Zero external runtime dependencies</div>
          </div>
        </div>
      </div>
    </section>
  )
}
