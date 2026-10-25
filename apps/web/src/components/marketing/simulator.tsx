"use client";

import { Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { PRESETS } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Tabs } from "../ui/tabs";

type Kind = "smoke" | "ramp" | "spike";
type Pt = { t: number; rps: number; p95: number };

/** Deterministic wobble so the example looks organic but renders identically for every visitor. */
const wob = (i: number, a: number) => Math.sin(i * 1.9) * a + Math.sin(i * 0.77 + 1) * a * 0.6;

function generate(kind: Kind): { pts: Pt[]; knee?: number; summary: string } {
  const N = 60;
  const pts: Pt[] = [];
  if (kind === "smoke") {
    for (let i = 0; i < N; i++) pts.push({ t: i / 2, rps: 118 + wob(i, 4) + Math.min(i, 4) * 3, p95: 17 + wob(i, 1.1) });
    return { pts, summary: "Flat throughput and flat latency. The target answers cleanly under light load." };
  }
  if (kind === "ramp") {
    const KNEE = 38;
    for (let i = 0; i < N; i++) {
      const demand = 20 + i * 8.2;
      const rps = Math.min(demand, 330 + (i > KNEE ? (i - KNEE) * 1.4 : 0)) + wob(i, 3);
      const over = Math.max(0, i - KNEE);
      pts.push({ t: i / 2, rps, p95: 21 + wob(i, 1.4) + (over > 0 ? 6 * over ** 1.55 : 0) });
    }
    return { pts, knee: KNEE / 2, summary: "Throughput climbs with load, then plateaus. P95 stays flat until the knee, then climbs steeply." };
  }
  for (let i = 0; i < N; i++) {
    const burst = i >= 12 && i < 40;
    const since = Math.max(0, i - 12);
    const rps = burst ? 540 + wob(i, 14) - Math.min(since, 8) * 4 : 70 + wob(i, 3);
    const p95 = burst ? 30 + 210 * Math.exp(-since / 9) + 55 * (since / 28) + wob(i, 4) : 20 + wob(i, 1);
    pts.push({ t: i / 2, rps, p95 });
  }
  return { pts, summary: "An instant burst. Latency spikes as the queue fills, then settles as workers catch up." };
}

const TABS = [
  { value: "smoke" as const, label: PRESETS[0].name },
  { value: "ramp" as const, label: PRESETS[1].name },
  { value: "spike" as const, label: PRESETS[2].name },
];

export function Simulator() {
  const [kind, setKind] = useState<Kind>("ramp");
  const sim = useMemo(() => generate(kind), [kind]);
  const [shown, setShown] = useState(sim.pts.length);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function play() {
    if (timer.current) clearInterval(timer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(sim.pts.length);
      return;
    }
    setShown(2);
    timer.current = setInterval(() => {
      setShown((s) => {
        if (s >= sim.pts.length) {
          if (timer.current) clearInterval(timer.current);
          return s;
        }
        return s + 1;
      });
    }, 55);
  }

  // Replay whenever the preset changes; clean up on unmount.
  useEffect(() => {
    play();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const visible = sim.pts.slice(0, shown);
  const peak = Math.max(...visible.map((p) => p.rps));
  const lastP95 = visible.at(-1)?.p95 ?? 0;
  const running = shown < sim.pts.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <Tabs label="Example preset" value={kind} onValueChange={setKind} items={TABS} />
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground">Example data</span>
          <Button variant="outline" size="sm" onClick={play} disabled={running}>
            {running ? <Play /> : <RotateCcw />} {running ? "Playing" : "Replay"}
          </Button>
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-3">
        <Stat label="Throughput" value={Math.round(visible.at(-1)?.rps ?? 0)} unit="RPS" />
        <Stat label="P95 latency" value={lastP95 >= 100 ? Math.round(lastP95) : Number(lastP95.toFixed(1))} unit="ms" warn={lastP95 > 120} />
        <Stat label="Peak so far" value={Math.round(peak)} unit="RPS" />
      </div>

      <div className="p-4 sm:p-5" role="img" aria-label={`Example ${kind} run. ${sim.summary}`}>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={visible} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="t" type="number" domain={[0, 30]} tickFormatter={(v: number) => `${v}s`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rps" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 700]} />
              <YAxis yAxisId="ms" orientation="right" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 400]} />
              {sim.knee !== undefined && shown > sim.knee * 2 && (
                <ReferenceLine yAxisId="rps" x={sim.knee} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: "Saturation knee", fill: "var(--warning-text)", fontSize: 11, position: "insideTopLeft" }} />
              )}
              <Line yAxisId="rps" dataKey="rps" type="monotone" stroke="var(--chart-throughput)" strokeWidth={2.25} dot={false} isAnimationActive={false} name="Throughput" />
              <Line yAxisId="ms" dataKey="p95" type="monotone" stroke="var(--chart-latency)" strokeWidth={2.25} dot={false} isAnimationActive={false} name="P95 latency" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--chart-throughput)]" /> Throughput (RPS)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--chart-latency)]" /> P95 latency (ms)
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{sim.summary} This is an illustration generated in your browser, not a measured run.</p>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, warn }: { label: string; value: number; unit: string; warn?: boolean }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("font-mono text-2xl font-semibold tnum", warn && "text-warning-text")}>{value.toLocaleString("en-US")}</span>
        <span className="font-mono text-xs text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
