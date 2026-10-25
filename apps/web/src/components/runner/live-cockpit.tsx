"use client";

import { Activity, Gauge, OctagonX, Timer, Users } from "lucide-react";
import { useMemo } from "react";
import { fmtClock, fmtMs, fmtRps, groupStatusCodes, isNum } from "@/lib/format";
import type { StreamState, TestSample } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "../fx/animated-number";
import { RunChart, RunChartTable } from "../run-chart";
import { StreamBadge } from "../status-badge";
import { Alert } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";

type Props = {
  name: string;
  samples: TestSample[];
  durationSec: number;
  targetConcurrency: number;
  elapsedSec: number;
  stream: StreamState;
  cancelling: boolean;
  lastUpdate: number | null;
  onAbort: () => void;
};

/** Sum status-code counts over every received sample (each sample carries that 500 ms window's counts). */
function accumulate(samples: TestSample[]) {
  const acc: Record<string, number> = {};
  for (const s of samples) for (const [k, v] of Object.entries(s.statusCodes ?? {})) acc[k] = (acc[k] ?? 0) + v;
  return acc;
}

function latencyTone(p95: number | undefined) {
  if (!isNum(p95)) return "text-foreground";
  if (p95 < 50) return "text-brand-strong dark:text-brand";
  if (p95 < 200) return "text-warning-text";
  return "text-danger-text";
}

export function LiveCockpit({ name, samples, durationSec, targetConcurrency, elapsedSec, stream, cancelling, lastUpdate, onAbort }: Props) {
  const latest = samples.at(-1);
  const codes = useMemo(() => groupStatusCodes(accumulate(samples)), [samples]);
  const remaining = Math.max(0, durationSec - elapsedSec);
  const pct = durationSec > 0 ? (elapsedSec / durationSec) * 100 : 0;
  const stale = stream === "live" && lastUpdate !== null && Date.now() - lastUpdate > 3000;

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden">
        {/* A glow that only exists while a test is truly running. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
        />
        <CardContent className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold tracking-tight">{name}</h2>
                <StreamBadge state={stream} />
                {cancelling && <Badge tone="warning">Cancelling</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground" aria-live="off">
                {stream === "reconnecting" ? "Connection dropped. Reconnecting — the last samples are kept as received." : `Streaming 500 ms samples. Last update ${lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "—"}.`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-mono text-2xl font-semibold tnum">{fmtClock(remaining)}</p>
                <p className="text-xs text-muted-foreground">remaining</p>
              </div>
              <Button variant="destructive" size="lg" onClick={onAbort} disabled={cancelling} className="relative">
                <span className="relative flex size-2.5">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-white/80" />
                  <span className="relative size-2.5 rounded-full bg-white" />
                </span>
                <OctagonX />
                {cancelling ? "Cancelling…" : "Abort test"}
              </Button>
            </div>
          </div>
          <Progress value={pct} label="Test progress" />
          {stale && <Alert tone="warning" title="Data is stale">No sample has arrived for several seconds. The numbers below are the last values received.</Alert>}
          {stream === "disconnected" && (
            <Alert tone="danger" title="Live stream disconnected">
              The server may still be running this test. Abort it to be sure, or open the run once it finishes.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* KPI dials */}
      <div className="grid gap-4 sm:grid-cols-3" aria-label="Live metrics">
        <Dial icon={<Gauge className="size-4" />} label="Live throughput" unit="RPS" value={latest?.rps} />
        <Dial
          icon={<Activity className="size-4" />}
          label="P95 tail latency"
          unit="ms"
          value={latest?.p95Ms}
          format={(v) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1))}
          valueClass={latencyTone(latest?.p95Ms)}
        />
        <Dial icon={<Users className="size-4" />} label="Active VUs" unit={`/ ${targetConcurrency}`} value={latest?.activeVUs} />
      </div>

      {/* Status code pills */}
      <div className="flex flex-wrap items-center gap-2" aria-label="HTTP status groups">
        <Pill tone="brand" label="2xx" value={codes.c2xx} />
        <Pill tone="neutral" label="3xx" value={codes.c3xx} />
        <Pill tone="warning" label="4xx" value={codes.c4xx} />
        <Pill tone="warning" label="429" value={codes.c429} />
        <Pill tone="danger" label="5xx" value={codes.c5xx} />
        <span className="ml-auto flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Timer className="size-3.5" /> {elapsedSec.toFixed(0)}s elapsed · P99 {fmtMs(latest?.p99Ms)}
        </span>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <RunChart samples={samples} height={320} windowSec={durationSec} />
          <RunChartTable samples={samples} />
        </CardContent>
      </Card>
    </div>
  );
}

function Dial({
  icon,
  label,
  unit,
  value,
  format,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  unit: string;
  value: number | undefined;
  format?: (v: number) => string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="grid size-6 place-items-center rounded-md bg-surface-muted">{icon}</span>
        {label}
      </p>
      <p className="mt-3 flex items-baseline gap-2">
        <AnimatedNumber value={value} format={format ?? ((v) => fmtRps(v))} className={cn("text-[40px] font-semibold leading-none tracking-tight", valueClass)} />
        <span className="font-mono text-sm text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function Pill({ tone, label, value }: { tone: "brand" | "neutral" | "warning" | "danger"; label: string; value: number }) {
  return (
    <Badge tone={tone} className="gap-2 px-3 py-1 text-[13px]">
      <span className="font-mono font-semibold">{label}</span>
      <span className="font-mono tnum">{value.toLocaleString("en-US")}</span>
    </Badge>
  );
}
