"use client";

import { memo, useMemo } from "react";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMs, fmtRps } from "@/lib/format";
import type { TestSample } from "@/lib/types";

type Point = { t: number; rps: number; p95: number; p99: number; vus: number };

export function samplesToPoints(samples: TestSample[]): Point[] {
  if (!samples.length) return [];
  const t0 = new Date(samples[0].timestamp).getTime();
  return samples.map((s) => ({
    t: Math.max(0, (new Date(s.timestamp).getTime() - t0) / 1000),
    rps: s.rps,
    p95: s.p95Ms,
    p99: s.p99Ms,
    vus: s.activeVUs,
  }));
}

type TipItem = { dataKey?: string; value?: number; color?: string; name?: string };

function ChartTip({ active, payload, label }: { active?: boolean; payload?: TipItem[]; label?: number | string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-mono text-muted-foreground">t = {Number(label).toFixed(1)} s</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-mono font-medium">
            {p.dataKey === "rps" ? `${fmtRps(p.value)} RPS` : p.dataKey === "vus" ? `${fmtRps(p.value)} VUs` : fmtMs(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

type Props = {
  samples: TestSample[];
  height?: number;
  showP99?: boolean;
  showVUs?: boolean;
  /** Fixed time window (seconds) so a live chart fills left → right. */
  windowSec?: number;
};

/**
 * Dual-axis chart: throughput (left, RPS) vs tail latency (right, ms).
 * Only real samples are plotted — gaps stay gaps, nothing is interpolated.
 */
function RunChartImpl({ samples, height = 300, showP99, showVUs, windowSec }: Props) {
  const data = useMemo(() => samplesToPoints(samples), [samples]);
  const maxT = data.length ? data[data.length - 1].t : 0;

  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Throughput and P95 latency over time. A data table follows the chart.">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, windowSec ? Math.max(windowSec, maxT) : "dataMax"]}
            tickFormatter={(v: number) => `${Math.round(v)}s`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="rps"
            orientation="left"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={46}
            label={{ value: "RPS", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11, dx: 10 }}
          />
          <YAxis
            yAxisId="ms"
            orientation="right"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={46}
            label={{ value: "P95 ms", angle: 90, position: "insideRight", fill: "var(--muted-foreground)", fontSize: 11, dx: -8 }}
          />
          <Tooltip content={(p) => <ChartTip active={p.active} payload={p.payload as unknown as TipItem[]} label={p.label as number | string} />} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line yAxisId="rps" type="monotone" dataKey="rps" name="Throughput" stroke="var(--chart-throughput)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          <Line yAxisId="ms" type="monotone" dataKey="p95" name="P95 latency" stroke="var(--chart-latency)" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          {showP99 && <Line yAxisId="ms" type="monotone" dataKey="p99" name="P99 latency" stroke="var(--destructive)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
          {showVUs && <Line yAxisId="rps" type="stepAfter" dataKey="vus" name="Active VUs" stroke="var(--info)" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export const RunChart = memo(RunChartImpl);

/** Tabular alternative to the chart for screen-reader and keyboard users. */
export function RunChartTable({ samples }: { samples: TestSample[] }) {
  const rows = samples.slice(-60);
  return (
    <details className="group rounded-lg border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        View chart data as a table ({rows.length} most recent samples)
      </summary>
      <div className="max-h-64 overflow-auto border-t border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-muted text-muted-foreground">
            <tr>
              {["Time", "RPS", "VUs", "P50", "P95", "P99", "Errors"].map((h) => (
                <th key={h} scope="col" className="px-3 py-1.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((s) => (
              <tr key={s.timestamp} className="border-t border-border">
                <td className="px-3 py-1.5">{new Date(s.timestamp).toLocaleTimeString()}</td>
                <td className="px-3 py-1.5">{fmtRps(s.rps)}</td>
                <td className="px-3 py-1.5">{fmtRps(s.activeVUs)}</td>
                <td className="px-3 py-1.5">{fmtMs(s.p50Ms)}</td>
                <td className="px-3 py-1.5">{fmtMs(s.p95Ms)}</td>
                <td className="px-3 py-1.5">{fmtMs(s.p99Ms)}</td>
                <td className="px-3 py-1.5">{fmtRps(s.errorCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
