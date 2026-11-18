"use client"

import * as React from "react"
import Link from "next/link"
import { Network, Sparkles, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { EndpointItem } from "@/lib/endpoint-api"

const HTTP_COLORS: Record<string, string> = {
  GET: "bg-success/15 text-success border-success/30",
  POST: "bg-brand/15 text-brand border-brand/30",
  PUT: "bg-warning/15 text-warning border-warning/30",
  PATCH: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  DELETE: "bg-danger/15 text-danger border-danger/30",
}

interface ProjectEndpointsPreviewProps {
  endpoints: EndpointItem[]
  isLoading: boolean
  projectId: string
  onOpenDiscovery: () => void
}

export function ProjectEndpointsPreview({
  endpoints,
  isLoading,
  projectId,
  onOpenDiscovery,
}: ProjectEndpointsPreviewProps) {
  return (
    <Card className="border-border bg-surface shadow-xs">
      <CardHeader className="pb-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
              <Network className="size-4 text-brand" />
              <span>Registered Target Endpoints</span>
            </CardTitle>
            <CardDescription className="text-xs text-foreground-muted font-mono">
              Routes registered for load testing and latency benchmarking.
            </CardDescription>
          </div>

          <Link
            href={`/dashboard/projects/${projectId}/endpoints`}
            className="font-mono text-xs text-brand hover:underline flex items-center gap-1"
          >
            <span>Full Catalog</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : endpoints.length === 0 ? (
          <div className="p-8 text-center space-y-3 font-mono text-xs">
            <p className="text-foreground-muted">No endpoints indexed for this project yet.</p>
            <Button
              onClick={onOpenDiscovery}
              className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
            >
              <Sparkles className="size-3" />
              <span>Open Discovery Guide</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                  <th className="py-3 px-4 font-semibold">Method & Path</th>
                  <th className="py-3 px-4 font-semibold">Service</th>
                  <th className="py-3 px-4 font-semibold text-right">P95 Latency</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {endpoints.slice(0, 5).map((ep: EndpointItem) => (
                  <tr key={ep.id} className="hover:bg-surface-raised/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
                            HTTP_COLORS[ep.method] || "bg-surface text-foreground-muted border-border"
                          }`}
                        >
                          {ep.method}
                        </span>
                        <span className="font-semibold text-foreground">{ep.path_template}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-foreground-muted">{ep.service || "default"}</td>

                    <td className="py-3 px-4 text-right text-foreground">
                      {ep.stats_1h?.p95_ms ? `${ep.stats_1h.p95_ms.toFixed(0)}ms` : "—"}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/runner?project=${projectId}&method=${ep.method}&path=${encodeURIComponent(
                          ep.path_template
                        )}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                          className: "h-7 text-[11px] font-mono px-2 text-brand hover:border-brand/40",
                        })}
                      >
                        Load Test
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
  )
}
