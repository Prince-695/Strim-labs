"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Network,
  Search,
  Plus,
  Sparkles,
  Rocket,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Layers,
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
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { endpointApi, type EndpointItem } from "@/lib/endpoint-api"
import { projectApi } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"

const HTTP_COLORS: Record<string, string> = {
  GET: "bg-success/15 text-success border-success/30",
  POST: "bg-brand/15 text-brand border-brand/30",
  PUT: "bg-warning/15 text-warning border-warning/30",
  PATCH: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  DELETE: "bg-danger/15 text-danger border-danger/30",
}

export default function EndpointsCatalogPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId, setProjectId } = useUIStore()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedMethod, setSelectedMethod] = React.useState<string>("ALL")
  const [isOpenApiModalOpen, setIsOpenApiModalOpen] = React.useState(false)
  const [openApiUrl, setOpenApiUrl] = React.useState("")
  const [importStatus, setImportStatus] = React.useState<{
    success: boolean
    message: string
  } | null>(null)

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

  // Auto-select first project if none selected
  React.useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setProjectId(projects[0].id)
    }
  }, [currentProjectId, projects, setProjectId])

  // 2. Fetch Endpoints List for the active project
  const { data: endpointsRes, isLoading } = useQuery({
    queryKey: ["endpoints_list", currentOrgId, activeProjectId],
    queryFn: () => endpointApi.list(currentOrgId!, activeProjectId),
    enabled: Boolean(currentOrgId && activeProjectId),
  })

  // 3. Import OpenAPI Mutation
  const importMutation = useMutation({
    mutationFn: (url: string) =>
      endpointApi.importOpenAPI(currentOrgId!, activeProjectId, { url }),
    onSuccess: (res) => {
      setImportStatus({
        success: true,
        message: `Imported successfully: ${res.data?.found || 0} found, ${res.data?.created || 0} created.`,
      })
      queryClient.invalidateQueries({
        queryKey: ["endpoints_list", currentOrgId, activeProjectId],
      })
      setTimeout(() => {
        setIsOpenApiModalOpen(false)
        setImportStatus(null)
        setOpenApiUrl("")
      }, 2000)
    },
    onError: (err: unknown) => {
      setImportStatus({
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "Failed to import OpenAPI specification.",
      })
    },
  })

  const allEndpoints = endpointsRes?.data || []

  // Filter endpoints
  const filteredEndpoints = allEndpoints.filter((ep: EndpointItem) => {
    const matchesQuery =
      searchQuery === "" ||
      ep.path_template.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.service?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesMethod =
      selectedMethod === "ALL" || ep.method.toUpperCase() === selectedMethod
    return matchesQuery && matchesMethod
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Endpoints"
        description="Catalog of discovered routes, latency performance, and test targets for your application."
        actions={
          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard/discovery"
              className={buttonVariants({
                variant: "outline",
                className:
                  "gap-1.5 border-border-subtle font-mono text-xs hover:bg-surface-raised",
              })}
            >
              <Sparkles className="size-3.5 text-brand" />
              <span>Discover APIs</span>
            </Link>
            <Button
              onClick={() => setIsOpenApiModalOpen(true)}
              className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
            >
              <Plus className="size-3.5" />
              <span>Import OpenAPI</span>
            </Button>
          </div>
        }
      />

      {/* Project Selector Bar */}
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
                      ? "verified"
                      : "unverified"
                  }
                />
              </div>
            )}
          </div>

          <div className="font-mono text-xs text-foreground-subtle">
            {allEndpoints.length} registered{" "}
            {allEndpoints.length === 1 ? "endpoint" : "endpoints"}
          </div>
        </CardContent>
      </Card>

      {/* Search & Method Filter */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="absolute top-2.5 left-3 size-4 text-foreground-subtle" />
          <Input
            placeholder="Search path, service, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border-subtle bg-surface-raised pl-9 font-mono text-xs"
          />
        </div>

        {/* Method Pills */}
        <div className="inline-flex w-full overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-1 font-mono text-xs sm:w-auto">
          {["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`rounded px-3 py-1 transition-colors ${
                selectedMethod === method
                  ? "bg-brand font-medium text-white"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoints Table Card */}
      <Card className="relative overflow-hidden border-border bg-surface shadow-xs">
        <CornerCrosshairs />
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredEndpoints.length === 0 ? (
            <EmptyState
              icon={<Network className="size-6 text-foreground-muted" />}
              title="No Endpoints Found"
              description={
                searchQuery || selectedMethod !== "ALL"
                  ? "No endpoints match the selected filter criteria."
                  : activeProject?.verification_status !== "verified"
                    ? "Verify your project domain to register and explore endpoints."
                    : "Import an OpenAPI/Swagger spec or run API Discovery to index your endpoints."
              }
              action={
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setIsOpenApiModalOpen(true)}
                    className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
                  >
                    <Plus className="size-3.5" />
                    <span>Import OpenAPI Spec</span>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                    <th className="px-4 py-3 font-semibold">Method & Path</th>
                    <th className="px-4 py-3 font-semibold">Service / Tag</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Reqs (1h)
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      P95 Latency
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Error Rate
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredEndpoints.map((ep: EndpointItem) => (
                    <tr
                      key={ep.id}
                      className="transition-colors hover:bg-surface-raised/30"
                    >
                      {/* Method + Path */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
                              HTTP_COLORS[ep.method] ||
                              "border-border bg-surface text-foreground-muted"
                            }`}
                          >
                            {ep.method}
                          </span>
                          <span className="font-semibold text-foreground">
                            {ep.path_template}
                          </span>
                        </div>
                      </td>

                      {/* Service / Tags */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground-muted">
                            {ep.service || "default"}
                          </span>
                          {ep.tags && ep.tags.length > 0 && (
                            <span className="rounded border border-border-subtle bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-subtle">
                              {ep.tags[0]}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Requests */}
                      <td className="px-4 py-3.5 text-right text-foreground">
                        {ep.stats_1h?.requests
                          ? ep.stats_1h.requests.toLocaleString()
                          : "—"}
                      </td>

                      {/* P95 Latency */}
                      <td className="px-4 py-3.5 text-right">
                        {ep.stats_1h?.p95_ms ? (
                          <span
                            className={
                              ep.stats_1h.p95_ms > 400
                                ? "font-semibold text-danger"
                                : ep.stats_1h.p95_ms > 200
                                  ? "text-warning"
                                  : "text-success"
                            }
                          >
                            {ep.stats_1h.p95_ms.toFixed(0)}ms
                          </span>
                        ) : (
                          <span className="text-foreground-subtle">—</span>
                        )}
                      </td>

                      {/* Error Rate */}
                      <td className="px-4 py-3.5 text-right">
                        {ep.stats_1h?.error_rate !== undefined ? (
                          <span
                            className={
                              ep.stats_1h.error_rate > 0.05
                                ? "font-semibold text-danger"
                                : ep.stats_1h.error_rate > 0.01
                                  ? "text-warning"
                                  : "text-foreground-muted"
                            }
                          >
                            {(ep.stats_1h.error_rate * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-foreground-subtle">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/runner?project=${activeProjectId}&method=${ep.method}&path=${encodeURIComponent(
                            ep.path_template
                          )}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                            className:
                              "h-7 gap-1 font-mono text-[11px] hover:border-brand/40 hover:text-brand",
                          })}
                        >
                          <Rocket className="size-3" />
                          <span>Load Test</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OpenAPI Import Modal */}
      {isOpenApiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg border-border bg-surface shadow-2xl">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base font-semibold text-foreground">
                  Import OpenAPI Specification
                </CardTitle>
                <button
                  onClick={() => setIsOpenApiModalOpen(false)}
                  className="rounded p-1 text-foreground-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <CardDescription className="font-mono text-xs text-foreground-muted">
                Provide a publicly accessible URL to an OpenAPI or Swagger
                JSON/YAML file.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-6 font-mono text-xs">
              {importStatus && (
                <div
                  className={`flex items-start gap-2.5 rounded-lg border p-3 ${
                    importStatus.success
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-foreground-muted">
                  Spec URL (JSON or YAML)
                </label>
                <Input
                  placeholder="https://api.example.com/openapi.json"
                  value={openApiUrl}
                  onChange={(e) => setOpenApiUrl(e.target.value)}
                  disabled={importMutation.isPending}
                  className="border-border-subtle bg-surface-raised font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpenApiModalOpen(false)}
                  disabled={importMutation.isPending}
                  className="font-mono text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => importMutation.mutate(openApiUrl)}
                  disabled={!openApiUrl || importMutation.isPending}
                  className="gap-1.5 bg-brand font-mono text-xs text-white hover:bg-brand-hover"
                >
                  {importMutation.isPending && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  <span>Import Spec</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
