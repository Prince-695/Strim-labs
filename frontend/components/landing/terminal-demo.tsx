"use client"

import * as React from "react"
import { Terminal, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

const snippetConfig = {
  request: `curl -X POST "https://strim-labs.onrender.com/v1/organizations/{org_id}/projects/{project_id}/load-tests" \\
  -H "Authorization: Bearer <STRIM_JWT_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Black Friday Peak Stress Test",
    "model": "open",
    "profile": "sustained",
    "start_rate": 50,
    "peak_rate": 1250,
    "duration_seconds": 60,
    "timeout_ms": 2000,
    "start_now": true,
    "targets": [
      { "method": "POST", "path": "/api/v1/checkout", "weight": 3 },
      { "method": "GET",  "path": "/api/v1/cart",     "weight": 7 }
    ]
  }'`,

  response: `{
  "success": true,
  "message": "Load test queued",
  "data": {
    "id": "lt-0192f1b2-7c1e-7a3b",
    "project_id": "proj-0192f1b0-4a8d",
    "name": "Black Friday Peak Stress Test",
    "status": "running",
    "model": "open",
    "profile": "sustained",
    "config": {
      "start_rate": 50,
      "peak_rate": 1250,
      "duration_seconds": 60,
      "timeout_ms": 2000
    },
    "created_at": "2026-11-15T12:00:00Z"
  },
  "request_id": "req-9f82d1",
  "response_time": "12.4ms"
}`,

  sse: `// GET /v1/.../load-tests/lt-0192f1b2-7c1e-7a3b/progress
event: snapshot
id: 1
data: {"status":"running","elapsed_seconds":0,"config_summary":{"profile":"sustained","peak_rate":1250}}

event: metrics
id: 2
data: {"t":5,"offered_rps":1250,"achieved_rps":1248,"p50_ms":14.2,"p95_ms":38.4,"p99_ms":92.1,"errors":0}

event: metrics
id: 3
data: {"t":15,"offered_rps":1250,"achieved_rps":1250,"p50_ms":15.0,"p95_ms":42.8,"p99_ms":105.4,"errors":2}

event: end
id: 4
data: {"reason":"completed","summary":{"sustainable_rps":1250,"breaking_point_rps":null}}`,
}

type TabType = "request" | "response" | "sse"

export function TerminalDemo() {
  const [activeTab, setActiveTab] = React.useState<TabType>("request")
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(snippetConfig[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section id="architecture" className="py-20 bg-surface/50 border-t border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-12">
          {/* Left Column: Description */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-mono text-sand mb-4">
              <Terminal className="size-3.5" />
              <span>DEVELOPER API FIRST</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl font-heading">
              Programmable load testing for modern CI/CD
            </h2>
            <p className="mt-4 text-sm sm:text-base text-foreground-muted leading-relaxed">
              Every feature in the STRIM console is backed by a fully documented REST and SSE endpoint.
              Launch tests from GitHub Actions, GitLab CI, or custom automation scripts using standardized DTOs.
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-medium text-foreground">Standardized Envelope Guarantee</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  Every response returns typed <code className="text-sand font-mono">data</code>, <code className="text-sand font-mono">request_id</code>, and microsecond <code className="text-sand font-mono">response_time</code>.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-medium text-foreground">Zero-Polling Server-Sent Events</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  Stream sub-second progress snapshots directly to your terminal or custom dashboard without aggressive polling.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Code Window */}
          <div className="w-full lg:max-w-2xl rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
            {/* Window Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab("request")}
                  className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${
                    activeTab === "request"
                      ? "bg-brand text-white font-medium"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  POST /load-tests
                </button>
                <button
                  onClick={() => setActiveTab("response")}
                  className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${
                    activeTab === "response"
                      ? "bg-brand text-white font-medium"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Response DTO
                </button>
                <button
                  onClick={() => setActiveTab("sse")}
                  className={`rounded px-2.5 py-1 text-xs font-mono transition-colors ${
                    activeTab === "sse"
                      ? "bg-brand text-white font-medium"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  SSE Stream
                </button>
              </div>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCopy}
                className="text-foreground-subtle hover:text-foreground"
                aria-label="Copy code snippet"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </Button>
            </div>

            {/* Code Content */}
            <pre className="p-4 overflow-x-auto text-xs font-mono text-foreground-muted leading-relaxed max-h-[380px] bg-background">
              <code>{snippetConfig[activeTab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
