"use client";

import {
  ArrowRight,
  Compass,
  Filter,
  Play,
  RefreshCw,
  Search,
  Shield,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { fmtDateTime, fmtMs } from "@/lib/format";
import { useDiscoveredRoutes } from "@/lib/queries";
import { useSession } from "@/lib/session";
import type { DiscoveredRoute } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default function ProjectApiExplorerPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const { project } = useSession();
  const { data: routes, isLoading, refetch, isFetching } = useDiscoveredRoutes(projectId);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return (routes ?? []).filter((r: DiscoveredRoute) => {
      const matchQuery = r.path.toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === "ALL" || r.method.toUpperCase() === methodFilter;
      return matchQuery && matchMethod;
    });
  }, [routes, search, methodFilter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-brand" />
              <CardTitle>Continuous API Explorer</CardTitle>
            </div>
            <CardDescription>
              Every production API route registered in real time by @strim/sdk. Launch a targeted breakpoint test against any endpoint with one click.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            loading={isFetching}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="size-3.5" /> Refresh Routes
          </Button>
        </CardHeader>

        {/* Filter / Search Bar */}
        <div className="flex flex-wrap items-center gap-3 border-t border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search discovered routes by path (e.g. /api/orders)..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1">
            {["ALL", "GET", "POST", "PUT", "DELETE"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethodFilter(m)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                  methodFilter === m
                    ? "bg-foreground text-background"
                    : "bg-surface-muted text-muted-foreground hover:bg-surface-muted/80 hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Routes Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              {search || methodFilter !== "ALL"
                ? "No routes matched your search filters."
                : "No routes recorded yet. Once your server receives requests, @strim/sdk will stream them here automatically."}
            </div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Method</TH>
                  <TH>Endpoint Path</TH>
                  <TH className="text-right">Total Production Calls</TH>
                  <TH className="text-right">Avg Latency</TH>
                  <TH className="text-right">P95 Latency</TH>
                  <TH className="text-right">Error Rate</TH>
                  <TH>Health Flag</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((route: DiscoveredRoute) => {
                  const errorRatio =
                    route.totalCalls > 0
                      ? ((route.errorCalls / route.totalCalls) * 100).toFixed(1)
                      : "0.0";
                  const hasErrors = route.errorCalls > 0;

                  return (
                    <TR key={route.id}>
                      <TD>
                        <Badge tone="outline" className="font-mono text-[10px] uppercase">
                          {route.method}
                        </Badge>
                      </TD>
                      <TD>
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {route.path}
                        </span>
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        {route.totalCalls.toLocaleString()}
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        {fmtMs(route.avgDurationMs)}
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        {fmtMs(route.p95DurationMs || route.avgDurationMs)}
                      </TD>
                      <TD className="text-right font-mono text-xs tnum">
                        <span className={hasErrors ? "text-rose-500 font-semibold" : "text-muted-foreground"}>
                          {errorRatio}%
                        </span>
                      </TD>
                      <TD>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            hasErrors ? "text-rose-500" : "text-emerald-500"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              hasErrors ? "bg-rose-500 animate-ping" : "bg-emerald-500"
                            }`}
                          />
                          {hasErrors ? "Degraded" : "Normal"}
                        </span>
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/projects/${projectId}/runner?path=${encodeURIComponent(route.path)}&method=${route.method}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          <Play className="size-3 fill-current" /> Run Test
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
