"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  FileCode2,
  Search,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
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

export default function ProjectEndpointsPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const { currentOrgId } = useUIStore()

  const projectId = (params?.id as string) || ""
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedMethod, setSelectedMethod] = React.useState<string>("ALL")
  const [isOpenApiModalOpen, setIsOpenApiModalOpen] = React.useState(false)
  const [openApiUrl, setOpenApiUrl] = React.useState("")
  const [importStatus, setImportStatus] = React.useState<{ success: boolean; message: string } | null>(null)

  // 1. Fetch Project Details for breadcrumb/title
  const { data: projectRes } = useQuery({
    queryKey: ["project_detail", currentOrgId, projectId],
    queryFn: () => projectApi.get(currentOrgId!, projectId),
    enabled: Boolean(currentOrgId && projectId),
  })

  // 2. Fetch Endpoints List
  const { data: endpointsRes, isLoading } = useQuery({
    queryKey: ["endpoints_list", currentOrgId, projectId],
    queryFn: () => endpointApi.list(currentOrgId!, projectId),
    enabled: Boolean(currentOrgId && projectId),
  })

  // 3. Import OpenAPI Mutation
  const importMutation = useMutation({
    mutationFn: (url: string) => endpointApi.importOpenAPI(currentOrgId!, projectId, { url }),
    onSuccess: (res) => {
      setImportStatus({
        success: true,
        message: `Imported successfully: ${res.data?.found || 0} found, ${res.data?.created || 0} created, ${res.data?.updated || 0} updated.`,
      })
      queryClient.invalidateQueries({ queryKey: ["endpoints_list", currentOrgId, projectId] })
      queryClient.invalidateQueries({ queryKey: ["project_detail", currentOrgId, projectId] })
      setTimeout(() => {
        setIsOpenApiModalOpen(false)
        setImportStatus(null)
        setOpenApiUrl("")
      }, 2500)
    },
    onError: (err: unknown) => {
      setImportStatus({
        success: false,
        message: err instanceof Error ? err.message : "Failed to import OpenAPI specification.",
      })
    },
  })

  const project = projectRes?.data
  const allEndpoints = endpointsRes?.data || []

  // Filter endpoints by search and method
  const filteredEndpoints = allEndpoints.filter((ep: EndpointItem) => {
    const matchesQuery =
      searchQuery === "" ||
      ep.path_template.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.service?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesMethod = selectedMethod === "ALL" || ep.method.toUpperCase() === selectedMethod
    return matchesQuery && matchesMethod
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Endpoint Registry & Discovery"
        description="Cataloged HTTP routes, observed traffic volume, and OpenAPI schemas for this target."
        breadcrumbs={[
          { label: "Projects", href: "/dashboard/projects" },
          { label: project?.name || "Target", href: `/dashboard/projects/${projectId}` },
          { label: "Endpoints" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsOpenApiModalOpen(true)}
              className="gap-2 bg-brand text-white hover:bg-brand-hover text-xs font-mono"
            >
              <DownloadCloud className="size-3.5" />
              <span>Import OpenAPI Spec</span>
            </Button>
          </div>
        }
      />

      {/* OpenAPI Import Dialog */}
      {isOpenApiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-border bg-surface shadow-2xl">
            <CardHeader className="pb-4 border-b border-border-subtle">
              <CardTitle className="text-base font-semibold font-heading text-foreground">
                Import OpenAPI / Swagger Spec
              </CardTitle>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                Provide a publicly reachable OpenAPI JSON or YAML URL to register endpoints.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-5 space-y-4 font-mono text-xs">
              {importStatus && (
                <div
                  className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                    importStatus.success
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{importStatus.message}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-foreground-muted">Spec URL</label>
                <Input
                  type="url"
                  placeholder="https://api.yourdomain.com/openapi.json"
                  value={openApiUrl}
                  onChange={(e) => setOpenApiUrl(e.target.value)}
                  disabled={importMutation.isPending}
                  className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsOpenApiModalOpen(false)}
                  disabled={importMutation.isPending}
                  className="text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => importMutation.mutate(openApiUrl)}
                  disabled={!openApiUrl || importMutation.isPending}
                  className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Syncing Spec...</span>
                    </>
                  ) : (
                    <span>Import Routes</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Method Filter Tabs */}
        <div className="inline-flex rounded-lg border border-border-subtle bg-surface-raised p-1 font-mono text-xs overflow-x-auto">
          {(["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((method) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`rounded px-3 py-1 transition-colors ${
                selectedMethod === method
                  ? "bg-brand text-white font-medium"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {method}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 size-3.5 text-foreground-subtle" />
          <Input
            placeholder="Filter by path or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs font-mono bg-surface border-border-subtle h-8"
          />
        </div>
      </div>

      {/* Endpoints Table Card */}
      <Card className="border-border bg-surface shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filteredEndpoints.length === 0 ? (
            <EmptyState
              icon={<FileCode2 className="size-6 text-sand" />}
              title={allEndpoints.length === 0 ? "No Endpoints Registered" : "No Endpoints Match Filters"}
              description={
                allEndpoints.length === 0
                  ? "Import an OpenAPI JSON specification or sync your discovery manifest to auto-populate routes."
                  : "Try clearing your search query or selecting a different HTTP method."
              }
              action={
                allEndpoints.length === 0 ? (
                  <Button
                    onClick={() => setIsOpenApiModalOpen(true)}
                    className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                  >
                    <DownloadCloud className="size-3.5" />
                    <span>Import OpenAPI Spec</span>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                    <th className="py-3 px-4 font-semibold">Method</th>
                    <th className="py-3 px-4 font-semibold">Path Template</th>
                    <th className="py-3 px-4 font-semibold">Service</th>
                    <th className="py-3 px-4 font-semibold text-right">1h RPS</th>
                    <th className="py-3 px-4 font-semibold text-right">1h P95 Latency</th>
                    <th className="py-3 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredEndpoints.map((ep: EndpointItem) => {
                    const methodClass = HTTP_COLORS[ep.method.toUpperCase()] || "bg-surface-raised text-foreground"

                    return (
                      <tr key={ep.id} className="hover:bg-surface-raised/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${methodClass}`}>
                            {ep.method.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {ep.path_template}
                        </td>
                        <td className="py-3 px-4 text-foreground-muted">
                          {ep.service || "default"}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {ep.stats_1h?.rps ? ep.stats_1h.rps.toFixed(1) : "0.0"}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {ep.stats_1h?.p95_ms ? `${ep.stats_1h.p95_ms.toFixed(1)}ms` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <StatusBadge
                            status={ep.status === "active" ? "completed" : "idle"}
                            label={ep.status.toUpperCase()}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
