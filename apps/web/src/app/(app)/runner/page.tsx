"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  Zap,
  Activity,
  Gauge,
  Clock,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  TrendingUp,
  Flame,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────
   Load Presets
   ───────────────────────────────────────────── */
const PRESETS = [
  {
    id: "smoke",
    label: "Smoke Probe",
    description: "Quick sanity check",
    icon: FlaskConical,
    concurrency: 10,
    durationSec: 10,
    profile: "SUSTAINED" as const,
    color: "text-status-info",
    bg: "bg-status-info/10 border-status-info/20",
  },
  {
    id: "ramp",
    label: "Capacity Ramp",
    description: "Find latency knee",
    icon: TrendingUp,
    concurrency: 50,
    durationSec: 30,
    profile: "RAMP_UP" as const,
    color: "text-status-success",
    bg: "bg-status-success/10 border-status-success/20",
  },
  {
    id: "spike",
    label: "Spike Surge",
    description: "Burst absorption test",
    icon: Flame,
    concurrency: 150,
    durationSec: 15,
    profile: "SPIKE" as const,
    color: "text-status-warning",
    bg: "bg-status-warning/10 border-status-warning/20",
  },
  {
    id: "breakpoint",
    label: "Breaking Point",
    description: "Push until failure",
    icon: AlertTriangle,
    concurrency: 300,
    durationSec: 45,
    profile: "RAMP_UP" as const,
    color: "text-status-danger",
    bg: "bg-status-danger/10 border-status-danger/20",
  },
];

type LiveMetric = {
  timestamp: string;
  rps: number;
  activeVUs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorCount: number;
  statusCodes: Record<string, number>;
};

export default function RunnerPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { token, orgId, projectId, projects } = useSession();

  const currentProject = projects.find((p) => p.id === projectId) ?? projects[0];

  // Configuration Form State
  const [testName, setTestName] = useState("API Stress Test");
  const [targetUrl, setTargetUrl] = useState(currentProject?.targetUrl ?? "https://httpbin.org/get");
  const [method, setMethod] = useState(currentProject?.defaultMethod ?? "GET");
  const [concurrency, setConcurrency] = useState(50);
  const [durationSec, setDurationSec] = useState(30);
  const [profile, setProfile] = useState<"RAMP_UP" | "SUSTAINED" | "SPIKE">("RAMP_UP");
  const [activePreset, setActivePreset] = useState<string | null>("ramp");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [headersText, setHeadersText] = useState('{\n  "Accept": "application/json"\n}');
  const [bodyText, setBodyText] = useState("");

  // Live Execution State
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetric[]>([]);
  const [currentRps, setCurrentRps] = useState(0);
  const [currentP95, setCurrentP95] = useState(0);
  const [currentVUs, setCurrentVUs] = useState(0);
  const [aggregatedStatuses, setAggregatedStatuses] = useState<Record<string, number>>({});
  const [elapsedSec, setElapsedSec] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (currentProject) {
      setTargetUrl(currentProject.targetUrl);
      setMethod(currentProject.defaultMethod || "GET");
    }
  }, [currentProject]);

  // Countdown timer
  useEffect(() => {
    if (isRunning) {
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const remainingSec = Math.max(0, durationSec - elapsedSec);

  function applyPreset(presetId: string) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setConcurrency(preset.concurrency);
    setDurationSec(preset.durationSec);
    setProfile(preset.profile);
    setActivePreset(presetId);
  }

  // Launch Load Test
  const launchMutation = useMutation({
    mutationFn: async () => {
      let parsedHeaders: Record<string, string> | undefined;
      try { if (headersText.trim()) parsedHeaders = JSON.parse(headersText); } catch { /* skip */ }
      let parsedBody: unknown;
      try { if (bodyText.trim()) parsedBody = JSON.parse(bodyText); } catch { /* skip */ }

      const res = await api<{ testRun: { id: string } }>("/v1/load-tests", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          projectId: currentProject?.id,
          name: testName,
          targetUrl,
          method,
          headers: parsedHeaders,
          body: parsedBody,
          concurrency: Number(concurrency),
          durationSec: Number(durationSec),
          profile,
        }),
      });
      return res.testRun;
    },
    onSuccess: (run) => {
      setActiveRunId(run.id);
      setIsRunning(true);
      setLiveMetrics([]);
      setAggregatedStatuses({});
      connectSseStream(run.id);
    },
  });

  // SSE Stream
  function connectSseStream(runId: string) {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const sse = new EventSource(`${API_URL}/v1/load-tests/${runId}/stream`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const metric = JSON.parse(event.data) as LiveMetric;
        setCurrentRps(metric.rps);
        setCurrentP95(metric.p95Ms);
        setCurrentVUs(metric.activeVUs);
        setLiveMetrics((prev) => [...prev.slice(-40), metric]);
        setAggregatedStatuses((prev) => {
          const next = { ...prev };
          for (const [code, count] of Object.entries(metric.statusCodes)) {
            next[code] = (next[code] ?? 0) + count;
          }
          return next;
        });
      } catch { /* skip */ }
    };

    sse.onerror = () => {
      sse.close();
      setIsRunning(false);
      qc.invalidateQueries({ queryKey: ["load-runs"] });
    };
  }

  // Abort
  const abortMutation = useMutation({
    mutationFn: async () => {
      if (!activeRunId) return;
      return api(`/v1/load-tests/${activeRunId}/stop`, { method: "POST", token, orgId });
    },
    onSuccess: () => {
      setIsRunning(false);
      if (eventSourceRef.current) eventSourceRef.current.close();
      qc.invalidateQueries({ queryKey: ["load-runs"] });
    },
  });

  const total2xx = Object.entries(aggregatedStatuses).filter(([c]) => c.startsWith("2")).reduce((s, [, v]) => s + v, 0);
  const total429 = aggregatedStatuses["429"] ?? 0;
  const total5xx = Object.entries(aggregatedStatuses).filter(([c]) => c.startsWith("5")).reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold tracking-tight text-foreground">
            Load Runner
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure and run real HTTP load tests against your target API.
          </p>
        </div>
        {activeRunId && !isRunning && (
          <Button
            variant="outline"
            className="rounded-lg text-xs font-semibold h-8 gap-1.5"
            onClick={() => router.push(`/tests/${activeRunId}`)}
          >
            View full analysis
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration */}
        <div className="lg:col-span-5 space-y-4">
          {/* Presets */}
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const selected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  disabled={isRunning}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all",
                    selected
                      ? `${preset.bg} border-current`
                      : "border-border/60 bg-card hover:bg-secondary/50"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("size-3.5", selected ? preset.color : "text-muted-foreground")} />
                    <span className={cn("text-xs font-semibold", selected ? "text-foreground" : "text-foreground")}>
                      {preset.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {preset.concurrency} VUs · {preset.durationSec}s
                  </span>
                </button>
              );
            })}
          </div>

          {/* Target & Config */}
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Test name</Label>
                <Input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  disabled={isRunning}
                  className="h-8 text-xs rounded-lg bg-secondary/40 border-border/60"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target endpoint</Label>
                <div className="flex gap-2">
                  <Select value={method} onValueChange={(val) => { if (val) setMethod(val); }} disabled={isRunning}>
                    <SelectTrigger className="w-[88px] h-8 text-xs rounded-lg bg-secondary/40 border-border/60 font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {["GET", "POST", "PUT", "DELETE"].map((m) => (
                        <SelectItem key={m} value={m} className="text-xs font-semibold">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    disabled={isRunning}
                    placeholder="https://api.example.com/endpoint"
                    className="h-8 text-xs rounded-lg bg-secondary/40 border-border/60 font-mono flex-1"
                  />
                </div>
              </div>

              {/* VU Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Virtual users</span>
                  <span className="font-mono font-tabular text-brand">{concurrency}</span>
                </div>
                <input
                  type="range" min="5" max="500" step="5"
                  value={concurrency}
                  onChange={(e) => { setConcurrency(Number(e.target.value)); setActivePreset(null); }}
                  disabled={isRunning}
                  className="w-full accent-[var(--brand)]"
                />
              </div>

              {/* Duration Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Duration</span>
                  <span className="font-mono font-tabular text-brand">{durationSec}s</span>
                </div>
                <input
                  type="range" min="10" max="180" step="5"
                  value={durationSec}
                  onChange={(e) => { setDurationSec(Number(e.target.value)); setActivePreset(null); }}
                  disabled={isRunning}
                  className="w-full accent-[var(--brand)]"
                />
              </div>

              {/* Profile */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Execution profile</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["RAMP_UP", "SUSTAINED", "SPIKE"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setProfile(p); setActivePreset(null); }}
                      disabled={isRunning}
                      className={cn(
                        "py-1.5 px-2 text-[11px] font-semibold rounded-lg border text-center transition-all",
                        profile === p
                          ? "border-brand bg-brand-subtle text-foreground"
                          : "border-border/60 bg-card text-muted-foreground hover:bg-secondary/50"
                      )}
                    >
                      {p === "RAMP_UP" ? "Ramp-Up" : p === "SUSTAINED" ? "Sustained" : "Spike"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
              >
                {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {showAdvanced ? "Hide advanced" : "Headers & payload"}
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Headers JSON</Label>
                    <textarea
                      value={headersText}
                      onChange={(e) => setHeadersText(e.target.value)}
                      disabled={isRunning}
                      rows={3}
                      className="w-full text-[11px] font-mono p-2 rounded-lg bg-secondary/40 border border-border/60"
                    />
                  </div>
                  {method !== "GET" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Body JSON</Label>
                      <textarea
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        disabled={isRunning}
                        rows={3}
                        placeholder='{"orderId": "ord_123"}'
                        className="w-full text-[11px] font-mono p-2 rounded-lg bg-secondary/40 border border-border/60"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Launch / Abort */}
              <div className="pt-1">
                {isRunning ? (
                  <Button
                    onClick={() => abortMutation.mutate()}
                    disabled={abortMutation.isPending}
                    variant="destructive"
                    className="w-full rounded-lg font-semibold text-xs h-10 gap-2"
                  >
                    <Square className="size-4" />
                    Abort test
                  </Button>
                ) : (
                  <Button
                    onClick={() => launchMutation.mutate()}
                    disabled={launchMutation.isPending || !targetUrl}
                    className="w-full rounded-lg bg-brand hover:bg-brand-strong text-white font-semibold text-xs h-10 gap-2"
                  >
                    <Play className="size-4" />
                    {launchMutation.isPending ? "Initializing…" : "Run load test"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Telemetry */}
        <div className="lg:col-span-7 space-y-4">
          {/* KPI Dials */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border/60">
              <CardContent className="p-3 space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide flex items-center gap-1">
                  <Gauge className="size-3 text-brand" />
                  Throughput
                </span>
                <p className="text-lg font-heading font-bold text-foreground font-tabular">
                  {Math.round(currentRps)} <span className="text-xs font-normal text-muted-foreground">RPS</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-3 space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide flex items-center gap-1">
                  <Clock className="size-3 text-status-warning" />
                  P95 Latency
                </span>
                <p className="text-lg font-heading font-bold text-foreground font-tabular">
                  {currentP95} <span className="text-xs font-normal text-muted-foreground">ms</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="p-3 space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide flex items-center gap-1">
                  <Activity className="size-3 text-status-info" />
                  Active VUs
                </span>
                <p className="text-lg font-heading font-bold text-foreground font-tabular">
                  {currentVUs}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Countdown & State */}
          {isRunning && (
            <Card className="border-brand/30 bg-brand-subtle">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-brand text-white text-[10px] font-semibold px-2 py-0.5 rounded-md animate-pulse">
                    Running
                  </Badge>
                  <span className="text-xs text-foreground font-medium">
                    {concurrency} VUs · {profile.replace("_", "-")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-heading font-bold text-foreground font-tabular">
                    {String(Math.floor(remainingSec / 60)).padStart(2, "0")}:{String(remainingSec % 60).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">remaining</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Chart */}
          <Card className="border-border/60">
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <CardTitle className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
                <Activity className="size-4 text-brand" />
                Throughput vs latency
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="h-56 w-full">
                {liveMetrics.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                    <Zap className="size-6 text-muted-foreground/20 mb-2" />
                    <p className="text-xs font-medium">Launch a test to see live metrics</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={liveMetrics}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis yAxisId="left" orientation="left" stroke="var(--brand)" fontSize={10} />
                      <YAxis yAxisId="right" orientation="right" stroke="var(--status-warning)" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "11px",
                        }}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="rps" stroke="var(--brand)" strokeWidth={2} dot={false} isAnimationActive={false} name="Throughput (RPS)" />
                      <Line yAxisId="right" type="monotone" dataKey="p95Ms" stroke="var(--status-warning)" strokeWidth={2} dot={false} isAnimationActive={false} name="P95 Latency (ms)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Code Pills */}
          <Card className="border-border/60">
            <CardContent className="p-3 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">
                Status codes
              </span>
              <StatusPill label="2xx" count={total2xx} variant="success" />
              <StatusPill label="429" count={total429} variant="warning" />
              <StatusPill label="5xx" count={total5xx} variant="danger" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ label, count, variant }: { label: string; count: number; variant: "success" | "warning" | "danger" }) {
  const styles = {
    success: "border-status-success/30 bg-status-success/10 text-status-success",
    warning: "border-status-warning/30 bg-status-warning/10 text-status-warning",
    danger: "border-status-danger/30 bg-status-danger/10 text-status-danger",
  };
  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-semibold font-tabular", styles[variant])}>
      <span>{label}</span>
      <span>{count.toLocaleString()}</span>
    </div>
  );
}
