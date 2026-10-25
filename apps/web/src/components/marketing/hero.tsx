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
  GitBranch,
  Layers,
  LineChart,
  Play,
  Radio,
  RotateCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Magnetic } from "../fx/magnetic";
import { buttonVariants } from "../ui/button";

const ROUTES = [
  {
    path: "/api/checkout/process",
    method: "POST",
    rps: 342,
    p50: 24,
    p95: 41,
    p99: 88,
    errorRate: 0.0,
    status: "healthy",
    flag: "Safe Band",
    flagColor: "text-brand bg-brand-subtle border-brand/30",
    kneeRps: 480,
    failureRps: 650,
  },
  {
    path: "/api/users/profile",
    method: "GET",
    rps: 520,
    p50: 16,
    p95: 114,
    p99: 310,
    errorRate: 0.24,
    status: "knee",
    flag: "Saturation Knee",
    flagColor: "text-warning bg-warning-subtle border-warning/30",
    kneeRps: 450,
    failureRps: 580,
  },
  {
    path: "/v1/search/stream",
    method: "GET",
    rps: 710,
    p50: 85,
    p95: 840,
    p99: 1820,
    errorRate: 11.2,
    status: "cliff",
    flag: "Breaking Cliff",
    flagColor: "text-destructive bg-danger-subtle border-destructive/30",
    kneeRps: 520,
    failureRps: 680,
  },
] as const;

const SDK_FRAMEWORKS = [
  {
    id: "hono",
    name: "Hono",
    lang: "typescript",
    code: `import { Hono } from "hono";
import { strim } from "@strim/sdk";

const app = new Hono();

// Single middleware: discovers all routes, methods & timings
app.use("*", strim({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_cmvntmj...",
}));

app.get("/api/checkout", (c) => c.json({ status: "ready" }));

export default app;`,
  },
  {
    id: "express",
    name: "Express",
    lang: "typescript",
    code: `import express from "express";
import { strimExpress } from "@strim/sdk/express";

const app = express();

app.use(strimExpress({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_cmvntmj...",
}));

app.listen(3000);`,
  },
  {
    id: "nextjs",
    name: "Next.js",
    lang: "typescript",
    code: `// middleware.ts
import { strimMiddleware } from "@strim/sdk/next";

export const middleware = strimMiddleware({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_cmvntmj...",
});

export const config = {
  matcher: ["/api/:path*"],
};`,
  },
] as const;

export function Hero() {
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"live" | "7day" | "sdk">("live");
  const [copied, setCopied] = useState(false);
  const [pulseTick, setPulseTick] = useState(0);
  const [sdkIdx, setSdkIdx] = useState(0);

  // Interactive concurrency scrubber for Tab 2
  const [scrubbedRps, setScrubbedRps] = useState(420);

  // Heartbeat simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseTick((t) => (t + 1) % 60);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  const route = ROUTES[selectedRouteIdx];
  const jitter = Math.sin(pulseTick * 0.8) * 4;
  const currentRps = Math.round(route.rps + jitter);

  // Derived state for Tab 2 scrubber
  const isSafe = scrubbedRps <= 340;
  const isKnee = scrubbedRps > 340 && scrubbedRps <= 520;
  const isCliff = scrubbedRps > 520;
  const calculatedLatency = isSafe
    ? Math.round(22 + (scrubbedRps / 340) * 16)
    : isKnee
    ? Math.round(38 + ((scrubbedRps - 340) / 180) * 160)
    : Math.round(198 + ((scrubbedRps - 520) / 180) * 1200);

  function copySdkCode() {
    navigator.clipboard.writeText(SDK_FRAMEWORKS[sdkIdx].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="relative overflow-hidden border-b border-border bg-background text-foreground transition-colors">
      {/* Background radial spotlights & subtle grid */}
      <div className="bg-grid mask-fade-b pointer-events-none absolute inset-0 opacity-40 dark:opacity-25" />
      <div className="pointer-events-none absolute left-1/2 top-0 size-[680px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-gradient-to-tr from-brand/20 via-emerald-500/15 to-info/15 blur-[140px] dark:from-brand/25 dark:via-emerald-500/20 dark:to-info/20" />
      <div className="pointer-events-none absolute -left-20 top-40 size-[420px] rounded-full bg-brand/10 blur-[130px] dark:bg-brand/15" />
      <div className="pointer-events-none absolute -right-20 top-20 size-[480px] rounded-full bg-info/12 blur-[130px] dark:bg-info/16" />

      {/* Main Content Container */}
      <div className="relative mx-auto max-w-[1240px] px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 lg:px-8">
        {/* Top Announcement Badge */}
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand/30 bg-brand-subtle/80 px-4 py-1.5 text-xs font-semibold text-brand-foreground backdrop-blur-md dark:border-brand/40 dark:bg-brand-subtle/40 dark:text-brand"
          >
            <Sparkles className="size-3.5 shrink-0 text-brand" />
            <span className="truncate">Continuous Observability &amp; Automated 7-Day Saturation Engine</span>
          </motion.div>
        </div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: EASE_OUT }}
          className="mx-auto mt-6 max-w-4xl text-center text-3xl font-medium leading-[1.08] tracking-[-0.035em] sm:text-5xl md:text-6xl lg:text-[68px]"
        >
          Find your API&apos;s breaking point{" "}
          <span className="bg-gradient-to-r from-brand via-brand-strong to-emerald-400 bg-clip-text text-transparent">
            before production does.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.16, ease: EASE_OUT }}
          className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl"
        >
          Plug in <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-foreground">@strim/sdk</code> with zero configuration. Get continuous production telemetry, automated weekly capacity knee ramps, and precise headroom answers.
        </motion.p>

        {/* Action CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.24, ease: EASE_OUT }}
          className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:mt-10 sm:flex-row"
        >
          <Magnetic>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "w-full shadow-lg shadow-brand/20 sm:w-auto")}
            >
              Launch console <ArrowRight className="size-4" />
            </Link>
          </Magnetic>
          <Link
            href="/how-it-works"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}
          >
            Explore how it works
          </Link>
        </motion.div>

        {/* Sleek Capability Metric Bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.32 }}
          className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border/80 bg-surface-muted/40 p-2 backdrop-blur-md shadow-xs"
        >
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-card/60 p-2 border border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Test Suites</span>
              <p className="mt-0.5 font-semibold text-foreground">Zero YAML Scripts</p>
            </div>
            <div className="rounded-xl bg-card/60 p-2 border border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Telemetry Window</span>
              <p className="mt-0.5 font-mono font-semibold text-brand">500 ms Sliding</p>
            </div>
            <div className="rounded-xl bg-card/60 p-2 border border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Headroom Engine</span>
              <p className="mt-0.5 font-semibold text-warning">Auto Knee Detection</p>
            </div>
            <div className="rounded-xl bg-card/60 p-2 border border-border/40">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">Diagnosis Cadence</span>
              <p className="mt-0.5 font-semibold text-info">7-Day Auto Ramps</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
