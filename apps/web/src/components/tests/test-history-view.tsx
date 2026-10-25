"use client";

import { ArrowUpDown, History, Play, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { fmtDateTime, fmtErrorRate, fmtMs, fmtRps, profileLabel } from "@/lib/format";
import { useRuns } from "@/lib/queries";
import { useSession } from "@/lib/session";

type SortKey = "startedAt" | "peakRps" | "p95Ms" | "errorRate";

export function TestHistoryView({ projectId: propProjectId }: { projectId?: string }) {
  const { projectId: sessionProjectId, project } = useSession();
  const effectiveProjectId = propProjectId || sessionProjectId;
  const { data: runs, isLoading, error, refetch, isFetching } = useRuns(effectiveProjectId, { refetchMs: 10_000 });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "startedAt", dir: -1 });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...(runs ?? [])]
      .filter((r) => (status === "ALL" ? true : status === "ABORTED" ? r.status === "ABORTED" || r.status === "CANCELLED" : r.status === status))
      .filter((r) => !term || r.name.toLowerCase().includes(term) || r.id.toLowerCase().includes(term) || r.targetUrl.toLowerCase().includes(term))
      .sort((a, b) => {
        const av = sort.key === "startedAt" ? new Date(a.startedAt || a.createdAt).getTime() : (a[sort.key] as number);
        const bv = sort.key === "startedAt" ? new Date(b.startedAt || b.createdAt).getTime() : (b[sort.key] as number);
        if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
        if (!Number.isFinite(av)) return 1;
        if (!Number.isFinite(bv)) return -1;
        return (av - bv) * sort.dir;
      });
  }, [runs, q, status, sort]);

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));
  }

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-foreground" aria-label={`Sort by ${children}`}>
      {children}
      <ArrowUpDown className={`size-3 ${sort.key === k ? "text-brand-strong dark:text-brand" : "opacity-50"}`} />
    </button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search runs by name, ID or path..." aria-label="Search runs" className="pl-9" />
          </div>
          <div className="w-44">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="ALL">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="RUNNING">Running</option>
              <option value="FAILED">Failed</option>
              <option value="ABORTED">Aborted</option>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={History} title="Couldn't load test runs" description="The history didn't load. Check your connection and retry." action={<Button onClick={() => refetch()} loading={isFetching}>Try again</Button>} />
        ) : !runs?.length ? (
          <EmptyState
            icon={History}
            title="No test runs recorded"
            description="Run a capacity test or saturation ramp against this project to record performance data."
            action={
              effectiveProjectId ? (
                <Link href={`/projects/${effectiveProjectId}/runner`} className={buttonVariants()}>
                  <Play className="size-3.5 mr-1" /> Open Breakpoint Runner
                </Link>
              ) : undefined
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={Search} title="No runs match" description="Try a different search term or clear the status filter." action={<Button variant="outline" onClick={() => { setQ(""); setStatus("ALL"); }}>Clear filters</Button>} />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Run Name</TH>
                <TH>Profile</TH>
                <TH><SortBtn k="startedAt">Started</SortBtn></TH>
                <TH className="text-right"><SortBtn k="peakRps">Peak RPS</SortBtn></TH>
                <TH className="text-right"><SortBtn k="p95Ms">P95 Latency</SortBtn></TH>
                <TH className="text-right"><SortBtn k="errorRate">Errors</SortBtn></TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <p className="max-w-64 truncate font-medium">{r.name}</p>
                    <p className="max-w-64 truncate font-mono text-xs text-muted-foreground">{r.targetUrl}</p>
                  </TD>
                  <TD>
                    <Badge tone="outline">
                      {r.concurrency} VUs · {profileLabel(r.profile)}
                    </Badge>
                  </TD>
                  <TD className="text-muted-foreground">{fmtDateTime(r.startedAt || r.createdAt)}</TD>
                  <TD className="text-right font-mono tnum">{fmtRps(r.peakRps)}</TD>
                  <TD className="text-right font-mono tnum">{fmtMs(r.p95Ms)}</TD>
                  <TD className="text-right font-mono tnum">{fmtErrorRate(r.errorRate)}</TD>
                  <TD>
                    <StatusBadge status={r.status} />
                  </TD>
                  <TD className="text-right">
                    <Link href={`/tests/${r.id}`} className="text-[13px] font-medium text-brand-strong hover:underline dark:text-brand">
                      View Results
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
