"use client"

import * as React from "react"
import Link from "next/link"
import { Sparkles, Network, CheckCircle2, AlertCircle, Loader2, Code2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { TelemetryMiddlewareModal } from "@/components/integrations/telemetry-middleware-modal"
import type { Project } from "@/lib/project-api"

interface ProjectDiscoveryGuideProps {
  project: Project
  discoverySpecUrl: string
  setDiscoverySpecUrl: (url: string) => void
  onScanSpec: (url: string) => void
  isScanning: boolean
  discoveryResult: string | null
  discoveryError: string | null
  endpointsCount: number
}

export function ProjectDiscoveryGuide({
  project,
  discoverySpecUrl,
  setDiscoverySpecUrl,
  onScanSpec,
  isScanning,
  discoveryResult,
  discoveryError,
  endpointsCount,
}: ProjectDiscoveryGuideProps) {
  const [isMiddlewareModalOpen, setIsMiddlewareModalOpen] = React.useState(false)

  return (
    <Card className="border-border bg-surface shadow-xs relative overflow-hidden">
      <CornerCrosshairs />
      <CardHeader className="border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold font-heading text-foreground">
              How to Discover & Register Endpoints
            </CardTitle>
            <CardDescription className="text-xs text-foreground-muted font-mono">
              Strim Labs uses automated schema parsing and routing metadata to catalog your APIs without manual configuration.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6 font-mono text-xs">
        {discoveryError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-danger">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{discoveryError}</span>
          </div>
        )}

        {discoveryResult && (
          <div className="flex items-start gap-2.5 rounded-lg border border-success/40 bg-success/10 p-3.5 text-success">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <span>{discoveryResult}</span>
          </div>
        )}

        {/* Method 1: OpenAPI Ingestion */}
        <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <span className="size-5 rounded bg-brand text-white flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Method 1: Ingest OpenAPI / Swagger Specification</span>
          </div>
          <p className="text-foreground-muted text-[11px] leading-relaxed">
            Provide a publicly accessible or internal URL to your OpenAPI JSON or YAML schema file. Strim Labs will extract all paths, HTTP verbs, and parameters.
          </p>

          <div className="flex gap-2 pt-1">
            <Input
              placeholder="https://api.yourdomain.com/openapi.json"
              value={discoverySpecUrl}
              onChange={(e) => setDiscoverySpecUrl(e.target.value)}
              className="bg-surface border-border-subtle text-xs font-mono"
            />
            <Button
              onClick={() => onScanSpec(discoverySpecUrl)}
              disabled={!discoverySpecUrl || isScanning}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono shrink-0 gap-1.5"
            >
              {isScanning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Scan Spec</span>
            </Button>
          </div>

          {/* Quick fill buttons */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] text-foreground-subtle block">
              Quick-fill common schema endpoints for {project.name}:
            </span>
            <div className="flex flex-wrap gap-2">
              {["/openapi.json", "/swagger.json", "/api-docs", "/v1/openapi.json"].map((p) => {
                const fullUrl = `${project.base_url.replace(/\/+$/, "")}${p}`
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDiscoverySpecUrl(fullUrl)}
                    className="rounded border border-border-subtle bg-surface px-2.5 py-1 text-[11px] text-sand hover:text-brand hover:border-brand/40 transition-colors"
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Method 2: Framework Code Snippets */}
        <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <span className="size-5 rounded bg-brand text-white flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Method 2: Expose OpenAPI in Your Framework</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Node.js Express */}
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <strong className="text-foreground block text-[11px]">Node.js (Express)</strong>
              <pre className="text-[10px] text-sand leading-relaxed overflow-x-auto p-2 bg-surface-raised rounded">
{`const swaggerUi = require('swagger-ui-express');
const doc = require('./swagger.json');
app.get('/openapi.json', (req, res) => res.json(doc));`}
              </pre>
            </div>

            {/* Python FastAPI */}
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <strong className="text-foreground block text-[11px]">Python (FastAPI)</strong>
              <pre className="text-[10px] text-sand leading-relaxed overflow-x-auto p-2 bg-surface-raised rounded">
{`from fastapi import FastAPI
app = FastAPI(
  openapi_url="/openapi.json"
)`}
              </pre>
            </div>

            {/* Go Gin */}
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <strong className="text-foreground block text-[11px]">Go (Gin / Swag)</strong>
              <pre className="text-[10px] text-sand leading-relaxed overflow-x-auto p-2 bg-surface-raised rounded">
{`import "github.com/swaggo/gin-swagger"
r.GET("/swagger/*any", 
  ginSwagger.WrapHandler(files.Handler))`}
              </pre>
            </div>
          </div>
        </div>

        {/* Method 3: Live Traffic Telemetry Middleware */}
        <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <span className="size-5 rounded bg-brand text-white flex items-center justify-center text-[10px]">
                3
              </span>
              <span>Method 3: Live Traffic Telemetry Middleware</span>
            </div>

            <Button
              type="button"
              onClick={() => setIsMiddlewareModalOpen(true)}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5 shrink-0"
            >
              <Code2 className="size-3.5" />
              <span>Add Live Traffic Telemetry</span>
            </Button>
          </div>

          <p className="text-[11px] text-foreground-muted leading-relaxed">
            Directly instrument your application server with the Strim Labs middleware. Endpoints and live telemetry are discovered and cataloged automatically from inbound production or staging requests.
          </p>
        </div>

        {/* Link to Full Catalog */}
        <div className="flex justify-end pt-2">
          <Link
            href={`/dashboard/projects/${project.id}/endpoints`}
            className={buttonVariants({
              className: "bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5",
            })}
          >
            <Network className="size-3.5" />
            <span>View All Registered Endpoints ({endpointsCount})</span>
          </Link>
        </div>

        {/* Telemetry Middleware Modal */}
        <TelemetryMiddlewareModal
          isOpen={isMiddlewareModalOpen}
          onClose={() => setIsMiddlewareModalOpen(false)}
          projectId={project.id}
        />
      </CardContent>
    </Card>
  )
}
