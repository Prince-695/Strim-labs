"use client"

import * as React from "react"
import Link from "next/link"
import {
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Key,
  Code2,
  ShieldCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"

interface TelemetryMiddlewareModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  apiKey?: string
}

type MiddlewareFramework = "node" | "python" | "curl"

export function TelemetryMiddlewareModal({
  isOpen,
  onClose,
  projectId = "<PROJECT_ID>",
  apiKey = "<PROJECT_API_KEY>",
}: TelemetryMiddlewareModalProps) {
  const [activeTab, setActiveTab] = React.useState<MiddlewareFramework>("node")
  const [copied, setCopied] = React.useState(false)

  if (!isOpen) return null

  const nodeSnippet = `// Install: npm install @strim-labs/node
import { strimMiddleware } from "@strim-labs/node";

// Mount middleware in Express
app.use(strimMiddleware({ 
  apiKey: "${apiKey}", 
  projectId: "${projectId}" 
}));`

  const pythonSnippet = `# Install: pip install strim-labs
from strim import StrimMiddleware

# Mount middleware in FastAPI
app.add_middleware(StrimMiddleware, api_key="${apiKey}")`

  const curlSnippet = `curl -X POST https://api.strimlabs.com/v1/ingest/events \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"service":"api","events":[{"method":"GET","path":"/health","status":200,"duration_ms":12.5}]}'`

  const currentSnippet =
    activeTab === "node"
      ? nodeSnippet
      : activeTab === "python"
        ? pythonSnippet
        : curlSnippet

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/70 p-4 backdrop-blur-xs duration-150 fade-in">
      <Card className="relative w-full max-w-2xl overflow-hidden border-border bg-surface font-mono shadow-2xl">
        <CornerCrosshairs />

        {/* Modal Header */}
        <CardHeader className="flex flex-row items-start justify-between border-b border-border-subtle pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 font-heading text-base font-semibold text-foreground">
              <Code2 className="size-4 text-brand" />
              <span>Add Live Traffic Telemetry</span>
            </CardTitle>
            <CardDescription className="font-mono text-xs text-foreground-muted">
              Inject real-time request metrics, latency distributions, and error
              logs into Strim Labs.
            </CardDescription>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-foreground-muted transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4 pt-5 text-xs">
          {/* Framework Selector Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <div className="inline-flex rounded-lg border border-border-subtle bg-surface-raised p-0.5">
              {(
                [
                  { id: "node", label: "Node.js (Express)" },
                  { id: "python", label: "Python (FastAPI)" },
                  { id: "curl", label: "cURL Test" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded px-3 py-1.5 font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-brand text-white shadow-xs"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copied ? "Copied to clipboard" : "Copy Snippet"}</span>
            </button>
          </div>

          {/* Snippet Display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-foreground-subtle">
              <span>
                {activeTab === "node"
                  ? "Express Middleware Integration:"
                  : activeTab === "python"
                    ? "FastAPI ASGI Middleware Integration:"
                    : "Manual Ingestion Event HTTP POST:"}
              </span>
              <span className="text-sand">
                Project: {projectId.slice(0, 16)}...
              </span>
            </div>

            <pre className="overflow-x-auto rounded-xl border border-border bg-background p-4 text-[11.5px] leading-relaxed text-sand selection:bg-brand/30">
              {currentSnippet}
            </pre>
          </div>

          {/* API Key Callout */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-3.5 text-[11px] sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-foreground-muted">
              <Key className="size-3.5 shrink-0 text-brand" />
              <span>
                Need a new ingestion token? Generate tokens with{" "}
                <code className="font-semibold text-foreground">ingest</code>{" "}
                scope in API Keys.
              </span>
            </div>

            <Link
              href="/dashboard/settings/api-keys"
              className="inline-flex shrink-0 items-center gap-1 font-medium text-brand hover:underline"
            >
              <span>Manage API Keys</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>

          {/* Close Action */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={onClose}
              className="border border-border-subtle bg-surface-raised px-4 font-mono text-xs text-foreground hover:bg-surface"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
