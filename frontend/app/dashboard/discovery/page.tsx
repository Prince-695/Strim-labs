"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Sparkles,
  FileCode,
  Network,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Globe,
  Radio,
  BookOpen,
  Code2,
  Copy,
  Check,
  Terminal,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { endpointApi, type DiscoveryRun } from "@/lib/endpoint-api"
import { projectApi } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function EndpointDiscoveryPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId, setProjectId } = useUIStore()

  const [specUrl, setSpecUrl] = React.useState("")
  const [selectedFramework, setSelectedFramework] = React.useState<
    "express" | "fastapi" | "go"
  >("express")
  const [copiedCode, setCopiedCode] = React.useState(false)
  const [lastRun, setLastRun] = React.useState<DiscoveryRun | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // 1. Fetch Projects list
  const { data: projectsRes } = useQuery({
    queryKey: ["projects_list", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  const projects = projectsRes?.data || []
  const activeProjectId =
    currentProjectId || (projects.length > 0 ? projects[0].id : "")
  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Auto-select first project
  React.useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setProjectId(projects[0].id)
    }
  }, [currentProjectId, projects, setProjectId])

  // 2. Import / Run Discovery Mutation
  const discoveryMutation = useMutation({
    mutationFn: (url: string) =>
      endpointApi.importOpenAPI(currentOrgId!, activeProjectId, { url }),
    onSuccess: (res) => {
      setErrorMessage(null)
      if (res.data) {
        setLastRun(res.data)
      }
      queryClient.invalidateQueries({
        queryKey: ["endpoints_list", currentOrgId, activeProjectId],
      })
      queryClient.invalidateQueries({
        queryKey: ["project_detail", currentOrgId, activeProjectId],
      })
    },
    onError: (err: unknown) => {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to run API discovery."
      )
    },
  })

  const handleAutofillPath = (path: string) => {
    if (!activeProject?.base_url) return
    const base = activeProject.base_url.replace(/\/+$/, "")
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    setSpecUrl(`${base}${cleanPath}`)
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Endpoint Discovery"
        description="Learn how to expose and automatically index your API routes into Strim Labs."
        breadcrumbs={[
          { label: "Endpoints", href: "/dashboard/endpoints" },
          { label: "Discovery" },
        ]}
      />

      {/* Target Project Selector */}
      <Card className="relative overflow-hidden border-border bg-surface">
        <CornerCrosshairs />
        <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-foreground-subtle uppercase">
              Target Project:
            </span>
            {projects.length > 0 ? (
              <select
                value={activeProjectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.environment})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-xs text-foreground-muted">
                No projects found
              </span>
            )}

            {activeProject && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-foreground-muted">
                  Base URL:{" "}
                  <strong className="text-foreground">
                    {activeProject.base_url}
                  </strong>
                </span>
                <StatusBadge
                  status={
                    activeProject.verification_status === "verified"
                      ? "completed"
                      : "pending"
                  }
                  label={
                    activeProject.verification_status === "verified"
                      ? "VERIFIED"
                      : "UNVERIFIED"
                  }
                />
              </div>
            )}
          </div>

          <Link
            href="/dashboard/endpoints"
            className="flex items-center gap-1 font-mono text-xs text-brand hover:underline"
          >
            <span>View Endpoints Catalog</span>
            <ArrowRight className="size-3" />
          </Link>
        </CardContent>
      </Card>

      {/* Discovery Configuration */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: OpenAPI Importer & Guide */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
            <CornerCrosshairs />
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
                  <FileCode className="size-4" />
                </div>
                <div>
                  <CardTitle className="font-heading text-sm font-semibold text-foreground">
                    1. Specification Ingestion Scanner
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-foreground-muted">
                    Ingest an OpenAPI 3.0+ or Swagger 2.0 schema to index all
                    endpoints, request bodies, and route tags.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-6 font-mono text-xs">
              {errorMessage && (
                <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {lastRun && (
                <div className="space-y-3 rounded-lg border border-success/40 bg-success/10 p-4">
                  <div className="flex items-center gap-2 font-semibold text-success">
                    <CheckCircle2 className="size-4" />
                    <span>Discovery Run Completed</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="rounded border border-border-subtle bg-surface-raised p-2">
                      <span className="block text-[10px] text-foreground-subtle uppercase">
                        Found
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {lastRun.found}
                      </span>
                    </div>
                    <div className="rounded border border-border-subtle bg-surface-raised p-2">
                      <span className="block text-[10px] text-foreground-subtle uppercase">
                        Created
                      </span>
                      <span className="text-sm font-bold text-brand">
                        {lastRun.created}
                      </span>
                    </div>
                    <div className="rounded border border-border-subtle bg-surface-raised p-2">
                      <span className="block text-[10px] text-foreground-subtle uppercase">
                        Updated
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {lastRun.updated}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Link
                      href="/dashboard/endpoints"
                      className={buttonVariants({
                        size: "sm",
                        className:
                          "gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover",
                      })}
                    >
                      <Network className="size-3.5" />
                      <span>View All Discovered Endpoints</span>
                    </Link>
                  </div>
                </div>
              )}

              {/* URL Input Form */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground-muted">
                  Specification Schema URL
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://api.yourdomain.com/openapi.json"
                    value={specUrl}
                    onChange={(e) => setSpecUrl(e.target.value)}
                    disabled={discoveryMutation.isPending}
                    className="border-border-subtle bg-surface-raised font-mono text-xs"
                  />
                  <Button
                    onClick={() => discoveryMutation.mutate(specUrl)}
                    disabled={!specUrl || discoveryMutation.isPending}
                    className="shrink-0 gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
                  >
                    {discoveryMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    <span>Run Scan</span>
                  </Button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              {activeProject?.base_url && (
                <div className="space-y-2 pt-1">
                  <span className="block text-[11px] text-foreground-subtle">
                    Quick-fill common schema endpoints for {activeProject.name}:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "/openapi.json",
                      "/swagger.json",
                      "/api-docs",
                      "/v1/openapi.json",
                    ].map((path) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => handleAutofillPath(path)}
                        className="rounded border border-border-subtle bg-surface-raised px-2.5 py-1 text-[11px] text-sand transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        {path}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Framework Code Guide */}
          <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
            <CornerCrosshairs />
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
                    <Code2 className="size-4 text-brand" />
                    <span>2. Framework Integration Guide</span>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-foreground-muted">
                    How to expose OpenAPI specifications in your backend code.
                  </CardDescription>
                </div>

                <div className="flex gap-1.5">
                  {(["express", "fastapi", "go"] as const).map((fw) => (
                    <button
                      key={fw}
                      onClick={() => setSelectedFramework(fw)}
                      className={`rounded border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        selectedFramework === fw
                          ? "border-brand bg-brand/10 font-medium text-white"
                          : "border-border-subtle bg-surface-raised text-foreground-muted hover:text-foreground"
                      }`}
                    >
                      {fw === "express" && "Node.js (Express)"}
                      {fw === "fastapi" && "Python (FastAPI)"}
                      {fw === "go" && "Go (Gin)"}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-4 font-mono text-xs">
              {selectedFramework === "express" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-foreground-muted">
                    Install{" "}
                    <code className="text-brand">swagger-ui-express</code> and
                    serve your JSON schema:
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-3 text-[11px] leading-relaxed text-sand">
                    {`const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();

// Expose schema endpoint for Strim Labs discovery
app.get('/openapi.json', (req, res) => res.json(swaggerDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));`}
                  </pre>
                </div>
              )}

              {selectedFramework === "fastapi" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-foreground-muted">
                    FastAPI automatically exports your schema at{" "}
                    <code className="text-brand">/openapi.json</code> by
                    default:
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-3 text-[11px] leading-relaxed text-sand">
                    {`from fastapi import FastAPI

app = FastAPI(
    title="My Production Service",
    openapi_url="/openapi.json",  # Strim Labs discovery target
    docs_url="/docs"
)

@app.get("/api/v1/users")
def get_users():
    return [{"id": 1, "name": "Alice"}]`}
                  </pre>
                </div>
              )}

              {selectedFramework === "go" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-foreground-muted">
                    Using <code className="text-brand">swaggo/gin-swagger</code>{" "}
                    to serve swagger documentation:
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-3 text-[11px] leading-relaxed text-sand">
                    {`package main

import (
    "github.com/gin-gonic/gin"
    swaggerFiles "github.com/swaggo/files"
    ginSwagger "github.com/swaggo/gin-swagger"
    _ "my-app/docs"
)

func main() {
    r := gin.Default()
    // Strim Labs scans: {BASE_URL}/swagger/doc.json
    r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
    r.Run(":8080")
}`}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: How Discovery Works */}
        <div className="space-y-4">
          <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
            <CornerCrosshairs />
            <CardHeader className="border-b border-border-subtle pb-3">
              <CardTitle className="text-xs font-semibold tracking-wider text-sand uppercase">
                Discovery Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 font-mono text-xs leading-relaxed text-foreground-muted">
              <div className="flex items-start gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-brand">
                  1
                </div>
                <div>
                  <strong className="block text-foreground">
                    Spec Parsing
                  </strong>
                  Parses paths, query parameters, headers, and schemas from
                  OpenAPI 3.0+ and Swagger 2.0 specs.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-brand">
                  2
                </div>
                <div>
                  <strong className="block text-foreground">
                    Route Normalization
                  </strong>
                  Extracts parameterized path templates (e.g.,{" "}
                  <code className="text-brand">/users/:id</code>) and HTTP
                  verbs.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-brand">
                  3
                </div>
                <div>
                  <strong className="block text-foreground">
                    Instant Target Mapping
                  </strong>
                  All parsed routes become immediately available for synthetic
                  stress tests in the Load Runner.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
