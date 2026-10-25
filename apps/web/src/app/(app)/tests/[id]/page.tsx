"use client";

import { ArrowLeftRight, Copy, GitBranch, RefreshCw, Terminal } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CapacityGauge } from "@/components/capacity-gauge";
import { CodeBlock } from "@/components/code-block";
import { DiagnosisCard } from "@/components/diagnosis-card";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { RunChart, RunChartTable } from "@/components/run-chart";
import { StatusBadge } from "@/components/status-badge";
import { StatusCodeGrid } from "@/components/status-codes";
import { Alert } from "@/components/ui/alert";
import { AccordionItem } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { ApiError, API_URL } from "@/lib/api";
import { diagnose } from "@/lib/analysis";
import { errorRateToPct, fmtDateTime, fmtErrorRate, fmtMs, fmtRps, isAbortedStatus, isNum, profileLabel } from "@/lib/format";
import { useRun } from "@/lib/queries";
import { curlSnippet, githubActionsSnippet, SECRETS_NOTE, snippetInputFromRun } from "@/lib/snippets";

export default function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [chartView, setChartView] = useState<"main" | "percentiles">("main");
  const [ciTab, setCiTab] = useState<"gha" | "curl">("gha");

  // Polls every 2 s only while the run is still executing.
  const { data: run, isLoading, error, refetch, isFetching } = useRun(id, { pollMs: 2000 });
  const live = run?.status === "RUNNING" || run?.status === "QUEUED";

  const diagnosis = useMemo(() => (run ? diagnose(run) : null), [run]);
  const snippetInput = useMemo(() => (run ? snippetInputFromRun(run, API_URL) : null), [run]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (error || !run) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <Card>
        <EmptyState
          icon={RefreshCw}
          title={notFound ? "Run not found" : "Couldn't load this run"}
          description={notFound ? "It may have been deleted, or it belongs to a different workspace." : error instanceof ApiError ? error.message : "Check your connection and try again."}
          action={
            <>
              <Button onClick={() => refetch()} loading={isFetching}>
                Try again
              </Button>
              <Link href="/tests" className={buttonVariants({ variant: "outline" })}>
                Back to history
              </Link>
            </>
          }
        />
      </Card>
    );
  }

  const samples = run.samples ?? [];
  const aborted = isAbortedStatus(run.status);
  const errPct = isNum(run.errorRate) ? errorRateToPct(run.errorRate) : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {run.name}
            <StatusBadge status={run.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono">
              {run.method} {run.targetUrl}
            </span>
            <span>{fmtDateTime(run.startedAt)}</span>
            <Badge tone="outline">
              {run.concurrency} VUs · {run.durationSec}s · {profileLabel(run.profile)}
            </Badge>
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(run.id).then(() => toast.success("Run ID copied"));
              }}
            >
              <Copy /> Copy run ID
            </Button>
            <Link href="/runner" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <RefreshCw /> Run again
            </Link>
            <Link href={`/compare?baselineId=${run.id}`} className={buttonVariants({ size: "sm" })}>
              <ArrowLeftRight /> Compare
            </Link>
          </>
        }
      />

      <div className="space-y-6">
        {live && (
          <Alert
            tone="info"
            title="This run is still in progress"
            action={
              <Link href="/runner" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open live cockpit
              </Link>
            }
          >
            Metrics below update every couple of seconds. Capacity analysis appears when the run finishes.
          </Alert>
        )}
        {aborted && (
          <Alert tone="warning" title="This run was aborted">
            Numbers reflect only the time before cancellation, so capacity zones may be unavailable.
          </Alert>
        )}
        {run.status === "FAILED" && (
          <Alert tone="danger" title="This run failed">
            The engine stopped before completing. Partial measurements are shown where they exist.
          </Alert>
        )}

        <section aria-label="Run summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Peak throughput" value={fmtRps(run.peakRps)} unit="RPS" tone="brand" definition="Highest requests per second in any 500 ms sample window." hint={`Average ${fmtRps(run.avgRps)} RPS`} />
          <MetricCard label="P95 latency" value={fmtMs(run.p95Ms)} definition="95% of requests completed at least this fast." hint={`P50 ${fmtMs(run.p50Ms)} · P99 ${fmtMs(run.p99Ms)}`} />
          <MetricCard
            label="Error rate"
            value={fmtErrorRate(run.errorRate)}
            tone={errPct === null ? "neutral" : errPct > 1 ? "danger" : errPct > 0 ? "warning" : "brand"}
            definition="Share of requests that returned an error, timed out or failed at the network level."
            hint={`${isNum(run.totalRequests) ? run.totalRequests.toLocaleString("en-US") : "—"} requests sent`}
          />
          <MetricCard label="Capacity knee" value={run.breakingPoint && run.breakingPoint.bottleneck !== "NONE" ? fmtRps(run.breakingPoint.kneeRps) : "—"} unit={run.breakingPoint && run.breakingPoint.bottleneck !== "NONE" ? "RPS" : undefined} tone="warning" definition="The load level where latency starts to curve upward and throughput stops scaling." hint={run.breakingPoint?.verdict ?? "Not determined for this run"} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Capacity spectrum</CardTitle>
            <CardDescription>Where this API stays safe, starts to saturate, and breaks. Zones appear only when the evidence supports them.</CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <CapacityGauge breakingPoint={run.breakingPoint} currentRps={run.peakRps} currentLabel="Peak" />
          </CardContent>
        </Card>

        {diagnosis && !live && <DiagnosisCard diagnosis={diagnosis} breakingPoint={run.breakingPoint} />}

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Telemetry</CardTitle>
              <CardDescription>500 ms samples as recorded. Gaps are shown as gaps.</CardDescription>
            </div>
            <Tabs
              label="Chart view"
              value={chartView}
              onValueChange={setChartView}
              items={[
                { value: "main", label: "Throughput vs P95" },
                { value: "percentiles", label: "Tail & VUs" },
              ]}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {samples.length ? (
              <>
                <RunChart samples={samples} height={340} showP99={chartView === "percentiles"} showVUs={chartView === "percentiles"} />
                <RunChartTable samples={samples} />
              </>
            ) : (
              <EmptyState icon={RefreshCw} title="No samples recorded" description={live ? "Samples will appear as the engine reports them." : "This run finished without recording any samples."} />
            )}
          </CardContent>
        </Card>

        <section aria-label="Status codes" className="space-y-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Status code distribution</h2>
          <StatusCodeGrid codes={run.statusCodes} total={run.totalRequests} />
        </section>

        {snippetInput && (
          <Card>
            <CardContent className="py-0">
              <AccordionItem
                icon={<GitBranch className="size-4 text-muted-foreground" />}
                title="Gate this endpoint in CI/CD"
                meta={<span className="text-xs font-normal text-muted-foreground">GitHub Actions · cURL</span>}
              >
                <div className="space-y-4 pt-1">
                  <Tabs
                    label="Snippet type"
                    value={ciTab}
                    onValueChange={setCiTab}
                    items={[
                      { value: "gha", label: "GitHub Actions", icon: <GitBranch className="size-3.5" /> },
                      { value: "curl", label: "cURL", icon: <Terminal className="size-3.5" /> },
                    ]}
                  />
                  <CodeBlock language={ciTab === "gha" ? "yaml" : "bash"} code={ciTab === "gha" ? githubActionsSnippet(snippetInput) : curlSnippet(snippetInput)} />
                  <p className="text-xs">{SECRETS_NOTE} This run is used as the baseline for the comparison step.</p>
                </div>
              </AccordionItem>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
