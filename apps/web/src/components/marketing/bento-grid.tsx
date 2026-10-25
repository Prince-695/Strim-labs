"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Cpu,
  Database,
  Filter,
  Globe,
  HardDrive,
  Layers,
  Lock,
  Play,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Timer,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { TiltCard } from "../fx/tilt-card";
import { WorldGlobe3D } from "./world-globe-3d";

// Framework SDK Snippets
const SDK_FRAMEWORKS = [
  {
    id: "hono",
    name: "Hono",
    badge: "Bun / Cloudflare / Node",
    code: `import { Hono } from "hono";
import { strim } from "@strim/sdk";

const app = new Hono();

// Single-line telemetry middleware
app.use("*", strim({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_9f81a7b...",
}));

app.get("/checkout", (c) => c.json({ status: "ready" }));

export default app;`,
  },
  {
    id: "express",
    name: "Express",
    badge: "Node.js v18+",
    code: `import express from "express";
import { strimExpress } from "@strim/sdk/express";

const app = express();

// Plug into top-level Express chain
app.use(strimExpress({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_9f81a7b...",
}));

app.get("/api/v1/orders", (req, res) => {
  res.json({ orders: [] });
});

app.listen(3000);`,
  },
  {
    id: "nextjs",
    name: "Next.js",
    badge: "App Router / Turbopack",
    code: `// middleware.ts
import { strimMiddleware } from "@strim/sdk/next";

export const middleware = strimMiddleware({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_9f81a7b...",
});

export const config = {
  matcher: ["/api/:path*"],
};`,
  },
  {
    id: "fastify",
    name: "Fastify",
    badge: "High Performance",
    code: `import Fastify from "fastify";
import { strimFastify } from "@strim/sdk/fastify";

const fastify = Fastify({ logger: true });

// Register auto-discovery hook
await fastify.register(strimFastify, {
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_9f81a7b...",
});

fastify.listen({ port: 8080 });`,
  },
] as const;

// Discovered live route mock stream
const DISCOVERED_ROUTES = [
  { path: "/api/checkout/process", method: "POST", status: 200, latency: 34, rps: 420, healthy: true },
  { path: "/v1/auth/session/refresh", method: "POST", status: 200, latency: 18, rps: 512, healthy: true },
  { path: "/api/inventory/items", method: "GET", status: 200, latency: 42, rps: 340, healthy: true },
  { path: "/v1/telemetry/heartbeat", method: "GET", status: 200, latency: 8, rps: 890, healthy: true },
  { path: "/api/users/profile/update", method: "PUT", status: 200, latency: 56, rps: 180, healthy: true },
  { path: "/api/webhooks/inbound", method: "POST", status: 504, latency: 1240, rps: 64, healthy: false },
];

export function BentoGrid() {
  // Ring Buffer Live Bars simulation
  const [bufferSurge, setBufferSurge] = useState(false);
  const [bars, setBars] = useState<number[]>([
    24, 38, 45, 52, 60, 48, 55, 72, 68, 80, 58, 62, 70, 85, 76, 90,
  ]);
  const [p95Live, setP95Live] = useState(38);

  // Auto-discovery filter
  const [routeFilter, setRouteFilter] = useState<"all" | "healthy" | "issues">("all");

  // SDK Framework tab
  const [selectedSdk, setSelectedSdk] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  // Firewall tester state
  const [firewallTarget, setFirewallTarget] = useState("169.254.169.254");
  const [firewallResult, setFirewallResult] = useState<"blocked" | "allowed">("blocked");

  // 7-Day Ramp simulation state
  const [isRamping, setIsRamping] = useState(false);
  const [rampProgress, setRampProgress] = useState(65);

  // Animate the 500ms ring buffer histogram
  useEffect(() => {
    const interval = setInterval(() => {
      setBars((prev) => {
        const base = bufferSurge ? 65 : 35;
        const nextVal = Math.min(100, Math.max(15, base + Math.floor((Math.random() - 0.45) * 45)));
        return [...prev.slice(1), nextVal];
      });

      setP95Live((prev) => {
        if (bufferSurge) return Math.min(160, Math.max(85, prev + Math.floor((Math.random() - 0.5) * 14)));
        return Math.min(48, Math.max(22, prev + Math.floor((Math.random() - 0.5) * 6)));
      });
    }, 600);

    return () => clearInterval(interval);
  }, [bufferSurge]);

  function handleCopy() {
    navigator.clipboard.writeText(SDK_FRAMEWORKS[selectedSdk].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function testFirewall(ip: string) {
    setFirewallTarget(ip);
    if (
      ip.startsWith("127.") ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("172.16.") ||
      ip.includes("169.254") ||
      ip.includes("localhost")
    ) {
      setFirewallResult("blocked");
    } else {
      setFirewallResult("allowed");
    }
  }

  function runWeeklySimulation() {
    if (isRamping) return;
    setIsRamping(true);
    setRampProgress(10);
    const step = setInterval(() => {
      setRampProgress((p) => {
        if (p >= 100) {
          clearInterval(step);
          setIsRamping(false);
          return 100;
        }
        return p + 15;
      });
    }, 300);
  }

  const filteredRoutes = DISCOVERED_ROUTES.filter((r) => {
    if (routeFilter === "healthy") return r.healthy;
    if (routeFilter === "issues") return !r.healthy;
    return true;
  });

  return (
    <section className="relative overflow-hidden border-b border-border bg-background py-24 sm:py-32">
      {/* Background Ambient Diagonal Mesh Spotlight in Cyber Emerald & Cobalt */}
      <div className="pointer-events-none absolute -top-40 left-1/4 size-[720px] rounded-full bg-brand/10 blur-[150px] dark:bg-brand/15" />
      <div className="pointer-events-none absolute top-1/2 -right-40 size-[640px] rounded-full bg-info/8 blur-[160px] dark:bg-info/12" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-[560px] rounded-full bg-warning/6 blur-[140px] dark:bg-warning/10" />

      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-subtle px-3.5 py-1 text-xs font-semibold text-brand-foreground dark:text-brand">
            <Sparkles className="size-3.5 text-brand" />
            <span>Zero-Config Telemetry & Load Architecture</span>
          </div>

          <h2 className="mt-5 text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-5xl lg:text-[52px] leading-[1.08]">
            Every edge, buffer, and breaking point.{" "}
            <span className="bg-gradient-to-r from-brand via-brand-strong to-emerald-400 bg-clip-text text-transparent">
              Visualized in real time.
            </span>
          </h2>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Built with STRIM&apos;s native Bun worker engine. Move from opaque log aggregators to live continuous telemetry, weekly saturation diagnosis, and instant route discovery.
          </p>
        </div>

        {/* ── BENTO GRID CONTAINER ── */}
        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ═══════════════════════════════════════════════════════════════════════
              BENTO ITEM 1 (Col Span 2 / Row 1): 3D WEBGL GLOBAL TELEMETRY GLOBE
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-2">
            <WorldGlobe3D />
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              BENTO ITEM 2 (Col Span 1 / Row 1): 500MS LOCK-FREE RING BUFFER
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all sm:p-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                  <Activity className="size-3 animate-pulse" /> 500ms Ring Buffer
                </span>
                <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  Lock-Free Memory
                </span>
              </div>

              <h3 className="mt-3.5 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Zero-GC Sliding Telemetry Buffer
              </h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Stores sliding 500ms micro-slices directly in pre-allocated typed arrays. Guarantees zero garbage collection pauses on your hot path.
              </p>

              {/* Live Waveform Histogram */}
              <div className="mt-5 rounded-2xl border border-border bg-surface-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                    Sliding 8s Sampling Window
                  </span>
                  <span className={cn(
                    "font-mono text-xs font-bold transition-colors",
                    bufferSurge ? "text-warning" : "text-brand"
                  )}>
                    Rolling P95: {p95Live}ms
                  </span>
                </div>

                <div className="mt-3 flex h-20 items-end gap-1.5">
                  {bars.map((bar, idx) => (
                    <div
                      key={idx}
                      className="group relative flex-1"
                      style={{ height: "100%" }}
                    >
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-300",
                          idx === bars.length - 1
                            ? "bg-brand animate-pulse shadow-sm shadow-brand"
                            : bar > 75
                            ? "bg-warning/80"
                            : "bg-brand/50 hover:bg-brand"
                        )}
                        style={{ height: `${bar}%` }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>-8.0s</span>
                  <span className="text-brand">Rolling P50 / P95 / P99</span>
                  <span>Now (Live)</span>
                </div>
              </div>

              {/* 4 Compact Telemetry Readouts */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border/70 bg-surface-muted/30 p-2.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">V8 GC Pauses</span>
                  <p className="font-mono text-sm font-bold text-brand">0.00 ms</p>
                  <p className="text-[10px] text-muted-foreground">Zero stop-the-world</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-muted/30 p-2.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Heap Footprint</span>
                  <p className="font-mono text-sm font-bold text-foreground">&lt; 1.8 MB</p>
                  <p className="text-[10px] text-muted-foreground">Pre-allocated array</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-muted/30 p-2.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Sample Slice</span>
                  <p className="font-mono text-sm font-bold text-brand">500 ms</p>
                  <p className="text-[10px] text-muted-foreground">Sliding window</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-surface-muted/30 p-2.5">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">Packet Loss</span>
                  <p className="font-mono text-sm font-bold text-foreground">0.00%</p>
                  <p className="text-[10px] text-muted-foreground">Lossless queue</p>
                </div>
              </div>
            </div>

            {/* Buffer Simulation Trigger */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">Traffic Surge Simulator</span>
                  <p className="text-[11px] text-muted-foreground">Inject synthetic 3x queue spike</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBufferSurge(!bufferSurge)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition-all shadow-xs",
                    bufferSurge
                      ? "border-warning bg-warning-subtle text-warning-text ring-2 ring-warning/20"
                      : "border-border bg-surface-muted text-foreground hover:bg-card"
                  )}
                >
                  {bufferSurge ? "Reset Baseline" : "Surge 3x Load"}
                </button>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              BENTO ITEM 3 (Col Span 1 / Row 2): ZERO-CONFIG ROUTE DISCOVERY
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all sm:p-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info-subtle px-2.5 py-0.5 text-[11px] font-semibold text-info">
                  <Search className="size-3" /> Zero-Config Discovery
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-brand">
                  <span className="size-1.5 rounded-full bg-brand animate-ping" />
                  Auto-Detecting
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Automatic Endpoint Discovery
              </h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                No OpenAPI or Swagger YAML required. The STRIM SDK registers live paths, methods, and parameters as requests arrive.
              </p>

              {/* Filter Tabs */}
              <div className="mt-4 flex gap-1.5">
                {(["all", "healthy", "issues"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRouteFilter(mode)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all",
                      routeFilter === mode
                        ? "bg-surface-muted text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {mode} {mode === "all" ? `(${DISCOVERED_ROUTES.length})` : mode === "healthy" ? "(5)" : "(1)"}
                  </button>
                ))}
              </div>

              {/* Route Live Stream List */}
              <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface-muted/30">
                {filteredRoutes.map((r) => (
                  <div key={r.path} className="flex items-center justify-between p-2.5 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                          r.method === "POST"
                            ? "bg-brand/20 text-brand"
                            : r.method === "PUT"
                            ? "bg-warning/20 text-warning"
                            : "bg-info/20 text-info"
                        )}
                      >
                        {r.method}
                      </span>
                      <span className="truncate font-mono text-xs text-foreground">{r.path}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
                      <span className={r.healthy ? "text-muted-foreground" : "font-bold text-destructive"}>
                        {r.latency}ms
                      </span>
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          r.healthy ? "bg-brand" : "bg-destructive animate-pulse"
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
              <span>Telemetry frames synced automatically</span>
              <span className="font-mono text-brand">0.08ms avg frame delay</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              BENTO ITEM 4 (Col Span 1 / Row 2): 7-DAY AUTOMATED SATURATION RAMP
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all sm:p-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-subtle px-2.5 py-0.5 text-[11px] font-semibold text-warning-text">
                  <Clock className="size-3" /> Scheduled 7-Day Cycle
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">Every Sun 02:00 UTC</span>
              </div>

              <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Weekly Saturation Knee Diagnosis
              </h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Runs automated concurrency ramps to calculate your exact headroom before customer traffic encounters queues.
              </p>

              {/* Saturation Curve Visual Graphic */}
              <div className="mt-5 rounded-2xl border border-border bg-surface-muted/40 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Capacity Knee Threshold</span>
                  <span className="font-mono text-brand font-bold">480 RPS Safe Peak</span>
                </div>

                <div className="relative mt-3 h-20 w-full">
                  <svg viewBox="0 0 300 80" className="size-full overflow-visible">
                    <defs>
                      <linearGradient id="curve-gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--brand)" />
                        <stop offset="60%" stopColor="var(--warning)" />
                        <stop offset="100%" stopColor="var(--destructive)" />
                      </linearGradient>
                    </defs>

                    {/* Safe Zone Area */}
                    <rect x="0" y="0" width="160" height="80" className="fill-brand/5" />
                    {/* Knee Area */}
                    <rect x="160" y="0" width="80" height="80" className="fill-warning/5" />
                    {/* Cliff Area */}
                    <rect x="240" y="0" width="60" height="80" className="fill-destructive/5" />

                    {/* S-Curve Latency Line */}
                    <path
                      d="M 10 65 Q 120 62 170 50 T 260 12"
                      fill="none"
                      stroke="url(#curve-gradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Knee Marker Dot */}
                    <circle cx="170" cy="50" r="5" className="fill-warning ring-2 ring-white" />
                    <text x="170" y="40" textAnchor="middle" className="fill-warning font-mono text-[9px] font-bold">
                      KNEE · 480 RPS
                    </text>
                  </svg>
                </div>

                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span className="text-brand">Safe Band (0–320)</span>
                  <span className="text-warning">Knee (320–480)</span>
                  <span className="text-destructive">Cliff (480+)</span>
                </div>
              </div>
            </div>

            {/* Simulation Trigger */}
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Last Run Result</span>
                  <p className="text-[11px] text-brand font-mono font-medium">+12% Headroom vs last week</p>
                </div>
                <button
                  type="button"
                  onClick={runWeeklySimulation}
                  disabled={isRamping}
                  className="flex items-center gap-1.5 rounded-xl border border-brand/40 bg-brand-subtle px-3 py-1.5 font-mono text-xs font-bold text-brand hover:bg-brand hover:text-brand-foreground transition-all shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-3", isRamping && "animate-spin")} />
                  <span>{isRamping ? `Ramping ${rampProgress}%` : "Run Ramp"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              BENTO ITEM 5 (Col Span 1 / Row 2): SSRF FIREWALL & ISOLATION
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all sm:p-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-danger-subtle px-2.5 py-0.5 text-[11px] font-semibold text-danger-text">
                  <ShieldCheck className="size-3" /> SSRF & Loopback Shield
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">&lt; 200ms Instant Abort</span>
              </div>

              <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Network Boundary Protection
              </h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Zero-trust socket verification prevents load workers from probing private subnets, cloud metadata APIs, or loopback interfaces.
              </p>

              {/* Interactive IP Firewall Probe Tester */}
              <div className="mt-5 rounded-2xl border border-border bg-surface-muted/40 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Interactive Target Probe Test:
                </span>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => testFirewall("169.254.169.254")}
                    className={cn(
                      "rounded-lg border px-2 py-1 font-mono text-xs transition-all",
                      firewallTarget === "169.254.169.254"
                        ? "border-destructive bg-danger-subtle text-destructive font-bold"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    169.254.169.254 (AWS)
                  </button>
                  <button
                    type="button"
                    onClick={() => testFirewall("127.0.0.1")}
                    className={cn(
                      "rounded-lg border px-2 py-1 font-mono text-xs transition-all",
                      firewallTarget === "127.0.0.1"
                        ? "border-destructive bg-danger-subtle text-destructive font-bold"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    127.0.0.1 (Loopback)
                  </button>
                  <button
                    type="button"
                    onClick={() => testFirewall("https://api.strim.dev")}
                    className={cn(
                      "rounded-lg border px-2 py-1 font-mono text-xs transition-all",
                      firewallTarget === "https://api.strim.dev"
                        ? "border-brand bg-brand-subtle text-brand font-bold"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    api.strim.dev
                  </button>
                </div>

                {/* Firewall Status HUD */}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    {firewallResult === "blocked" ? (
                      <ShieldAlert className="size-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="size-4 text-brand" />
                    )}
                    <span className="font-mono text-xs font-semibold text-foreground truncate max-w-[150px]">
                      {firewallTarget}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 font-mono text-[11px] font-bold",
                      firewallResult === "blocked"
                        ? "bg-danger-subtle text-destructive border border-destructive/30"
                        : "bg-brand-subtle text-brand border border-brand/30"
                    )}
                  >
                    {firewallResult === "blocked" ? "403 BLOCKED" : "200 ALLOWED"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Strict RFC 1918 Private IP Filter</span>
              <span className="font-mono text-brand">Zero TCP socket leak</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              BENTO ITEM 6 (Col Span 3 / Row 3): STRIPE-STYLE 1-LINE SDK TERMINAL
             ═══════════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-3 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left Info Column */}
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                    <Code2 className="size-3" /> One-Line Polyglot Middleware
                  </span>
                  <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                    &lt; 0.12ms Overhead
                  </span>
                </div>

                <h3 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Drop it into your framework. Nothing to maintain.
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Works with Bun, Node.js, and Edge runtimes. Collects lightweight latency histograms and errors in a 500ms memory window without sending private API payloads to the cloud.
                </p>

                {/* Key Benefits Grid */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Latency Overhead
                    </span>
                    <p className="font-mono text-base font-bold text-brand">&lt; 0.12 ms</p>
                    <p className="text-[11px] text-muted-foreground">Zero async bottlenecks</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-muted/40 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sensitive Data
                    </span>
                    <p className="font-mono text-base font-bold text-foreground">Zero Payload</p>
                    <p className="text-[11px] text-muted-foreground">Headers &amp; body sanitized</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-muted/40 p-3 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      CI / CD Secrets
                    </span>
                    <p className="font-mono text-base font-bold text-brand">AES-256-GCM</p>
                    <p className="text-[11px] text-muted-foreground">Keys never committed to git</p>
                  </div>
                </div>
              </div>

              {/* Right Code Terminal Column */}
              <div className="w-full lg:max-w-xl">
                {/* Framework Selector Tabs */}
                <div className="flex items-center justify-between rounded-t-2xl border border-b-0 border-border bg-surface-muted/80 px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {SDK_FRAMEWORKS.map((fw, idx) => (
                      <button
                        key={fw.id}
                        type="button"
                        onClick={() => setSelectedSdk(idx)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                          selectedSdk === idx
                            ? "bg-card text-foreground font-bold shadow-xs border border-border"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {fw.name}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted transition-colors shadow-xs"
                  >
                    {copied ? <Check className="size-3 text-brand" /> : <Copy className="size-3 text-muted-foreground" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                {/* Code Body */}
                <div className="relative overflow-hidden rounded-b-2xl border border-border bg-[#0a0f14] p-4 text-emerald-400 font-mono text-xs leading-relaxed shadow-xl">
                  <div className="pointer-events-none absolute right-4 top-4 rounded bg-emerald-950/60 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-800/40 font-mono">
                    {SDK_FRAMEWORKS[selectedSdk].badge}
                  </div>
                  <pre className="overflow-x-auto text-[12px] text-slate-200">
                    <code>{SDK_FRAMEWORKS[selectedSdk].code}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
