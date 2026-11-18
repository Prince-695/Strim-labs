"use client"

import * as React from "react"
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Lock,
  Code2,
  FileCode,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import type { Project } from "@/lib/project-api"

export type VerificationTech = "nextjs" | "node" | "python" | "go" | "dns"
export type NextRouterType = "app" | "pages"

interface ProjectVerificationPanelProps {
  project: Project
  isVerified: boolean
  verifyToken: string
  verifyStatus: { success: boolean; message: string } | null
  onVerify: () => void
  isVerifying: boolean
}

export function ProjectVerificationPanel({
  project,
  isVerified,
  verifyToken,
  verifyStatus,
  onVerify,
  isVerifying,
}: ProjectVerificationPanelProps) {
  const [tech, setTech] = React.useState<VerificationTech>("nextjs")
  const [nextRouter, setNextRouter] = React.useState<NextRouterType>("app")
  const [copiedToken, setCopiedToken] = React.useState(false)
  const [copiedSnippet, setCopiedSnippet] = React.useState(false)

  const copyToClipboard = (text: string, isSnippet = false) => {
    navigator.clipboard.writeText(text)
    if (isSnippet) {
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 2000)
    } else {
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  // Construct verification URL
  const baseNormalized = project.base_url.replace(/\/+$/, "")
  const verificationUrl = `${baseNormalized}/.well-known/strim-verification`

  // Code snippets generator
  const getSnippet = () => {
    switch (tech) {
      case "nextjs":
        if (nextRouter === "app") {
          return `// app/.well-known/strim-verification/route.ts
export async function GET() {
  return new Response("strim-verify=${verifyToken}", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  })
}`
        }
        return `// pages/.well-known/strim-verification.ts
import type { NextApiRequest, NextApiResponse } from "next"

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Content-Type", "text/plain")
  res.status(200).send("strim-verify=${verifyToken}")
}`

      case "node":
        return `// Express.js route in server.js or app.js
app.get('/.well-known/strim-verification', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('strim-verify=${verifyToken}');
});`

      case "python":
        return `# FastAPI route in main.py
from fastapi.responses import PlainTextResponse

@app.get('/.well-known/strim-verification', response_class=PlainTextResponse)
def strim_verify():
    return 'strim-verify=${verifyToken}'`

      case "go":
        return `// Gin route in main.go
r.GET("/.well-known/strim-verification", func(c *gin.Context) {
    c.String(200, "strim-verify=${verifyToken}")
})`

      case "dns":
        return `Host: _strim-verification
Type: TXT
Value: strim-verify=${verifyToken}`
    }
  }

  return (
    <Card className="border-border bg-surface shadow-xs relative overflow-hidden">
      <CornerCrosshairs />
      <CardHeader className="border-b border-border-subtle pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold font-heading text-foreground flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-400" />
              <span>Domain Authority & Ownership Verification</span>
            </CardTitle>
            <CardDescription className="text-xs text-foreground-muted font-mono mt-0.5">
              Verify ownership of <span className="text-foreground font-medium">{project.base_url}</span> to unlock the project cockpit and distributed load testing.
            </CardDescription>
          </div>
          <StatusBadge
            status={isVerified ? "completed" : "pending"}
            label={isVerified ? "VERIFIED" : "UNVERIFIED"}
          />
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-5 font-mono text-xs">
        {/* Verification result feedback banner */}
        {verifyStatus && (
          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3.5 transition-all ${
              verifyStatus.success
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger"
            }`}
          >
            {verifyStatus.success ? (
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="font-semibold block">
                {verifyStatus.success ? "Domain Verified Successfully" : "Verification Check Failed"}
              </span>
              <p className="text-[11px] opacity-90">{verifyStatus.message}</p>
            </div>
          </div>
        )}

        {/* Expected Endpoint Banner */}
        <div className="rounded-xl border border-border-subtle bg-surface-raised/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-foreground-subtle shrink-0">Verification Endpoint:</span>
            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline font-medium truncate inline-flex items-center gap-1"
            >
              <span>{verificationUrl}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => copyToClipboard(`strim-verify=${verifyToken}`)}
              className="inline-flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground bg-surface px-2.5 py-1 rounded border border-border-subtle hover:border-border transition-colors"
            >
              {copiedToken ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              <span>{copiedToken ? "Token Copied" : "Copy Token"}</span>
            </button>
          </div>
        </div>

        {/* Technology Method Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-foreground-subtle uppercase tracking-wider font-semibold">
              Select Framework / Method:
            </span>
            {tech === "nextjs" && (
              <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5 border border-border-subtle">
                <button
                  type="button"
                  onClick={() => setNextRouter("app")}
                  className={`px-2.5 py-0.5 rounded text-[11px] transition-colors ${
                    nextRouter === "app"
                      ? "bg-brand/15 text-white font-medium border border-brand/30"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  App Router
                </button>
                <button
                  type="button"
                  onClick={() => setNextRouter("pages")}
                  className={`px-2.5 py-0.5 rounded text-[11px] transition-colors ${
                    nextRouter === "pages"
                      ? "bg-brand/15 text-white font-medium border border-brand/30"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  Pages Router
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "nextjs", label: "Next.js (App / Pages)" },
                { id: "node", label: "Node.js (Express)" },
                { id: "python", label: "Python (FastAPI)" },
                { id: "go", label: "Go (Gin)" },
                { id: "dns", label: "DNS TXT Record" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTech(t.id)}
                className={`rounded-lg px-3 py-1.5 border transition-colors ${
                  tech === t.id
                    ? "border-brand bg-brand/10 text-white font-medium"
                    : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Code / Record Display */}
        <div className="rounded-xl border border-border-subtle bg-surface-raised/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground-muted text-[11px]">
              {tech === "dns" ? (
                <span>Add TXT Record in DNS Settings:</span>
              ) : (
                <>
                  <FileCode className="size-3.5 text-brand" />
                  <span>
                    {tech === "nextjs"
                      ? nextRouter === "app"
                        ? "File: app/.well-known/strim-verification/route.ts"
                        : "File: pages/.well-known/strim-verification.ts"
                      : tech === "node"
                      ? "File: server.js or app.js"
                      : tech === "python"
                      ? "File: main.py"
                      : "File: main.go"}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(getSnippet(), true)}
              className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
            >
              {copiedSnippet ? <Check className="size-3" /> : <Copy className="size-3" />}
              <span>{copiedSnippet ? "Snippet Copied" : "Copy Snippet"}</span>
            </button>
          </div>

          {tech === "dns" ? (
            <div className="space-y-2 p-3 bg-surface rounded-lg border border-border">
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/50">
                <span className="text-foreground-subtle">Record Type:</span>
                <span className="text-foreground font-semibold">TXT</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/50">
                <span className="text-foreground-subtle">Host / Name:</span>
                <span className="text-foreground font-semibold">_strim-verification</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-foreground-subtle">Value:</span>
                <span className="text-brand font-semibold break-all">strim-verify={verifyToken}</span>
              </div>
            </div>
          ) : (
            <pre className="p-3 bg-surface rounded-lg border border-border text-sand text-[11px] leading-relaxed overflow-x-auto">
              {getSnippet()}
            </pre>
          )}

          <p className="text-[11px] text-foreground-subtle leading-relaxed">
            {tech === "dns"
              ? "DNS TXT propagation may take between 1 to 5 minutes depending on your domain registrar."
              : `Deploy the route to ${project.base_url}. Strim Labs will send a GET request to verify the token match.`}
          </p>
        </div>

        {/* Verification Trigger Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-foreground-subtle text-[11px]">
            <Lock className="size-3.5 text-foreground-muted" />
            <span>Project cockpit unlocks immediately upon verification.</span>
          </div>

          <Button
            onClick={onVerify}
            disabled={isVerifying}
            className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5 shrink-0"
          >
            {isVerifying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            <span>{isVerified ? "Re-run Verification Check" : "Run Verification Check"}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
