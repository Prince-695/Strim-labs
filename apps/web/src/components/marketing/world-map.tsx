"use client";

import { motion } from "framer-motion";
import { Activity, Globe, Radio, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RegionNode {
  id: string;
  name: string;
  country: string;
  code: string;
  x: number;
  y: number;
  latencyMs: number;
  rps: number;
  status: "safe" | "knee" | "active";
}

const REGIONS: RegionNode[] = [
  { id: "us-west", name: "US West", country: "San Francisco", code: "SFO", x: 175, y: 140, latencyMs: 14, rps: 1850, status: "safe" },
  { id: "us-east", name: "US East", country: "Virginia", code: "IAD", x: 275, y: 152, latencyMs: 22, rps: 2420, status: "safe" },
  { id: "eu-west", name: "EU West", country: "London", code: "LHR", x: 478, y: 118, latencyMs: 28, rps: 1940, status: "safe" },
  { id: "eu-central", name: "EU Central", country: "Frankfurt", code: "FRA", x: 518, y: 125, latencyMs: 31, rps: 1680, status: "safe" },
  { id: "ap-south", name: "AP South", country: "Mumbai", code: "BOM", x: 678, y: 198, latencyMs: 42, rps: 1210, status: "knee" },
  { id: "ap-southeast", name: "AP Southeast", country: "Singapore", code: "SIN", x: 765, y: 242, latencyMs: 54, rps: 1450, status: "safe" },
  { id: "ap-northeast", name: "AP East", country: "Tokyo", code: "NRT", x: 848, y: 158, latencyMs: 68, rps: 1780, status: "safe" },
  { id: "sa-east", name: "SA East", country: "São Paulo", code: "GRU", x: 345, y: 285, latencyMs: 82, rps: 640, status: "safe" },
  { id: "oc-east", name: "Oceania", country: "Sydney", code: "SYD", x: 875, y: 315, latencyMs: 95, rps: 820, status: "knee" },
];

// Target origin server (central coordinator)
const ORIGIN = { x: 275, y: 152, name: "Origin API Target (IAD)" };

export function WorldMap() {
  const [selectedRegion, setSelectedRegion] = useState<RegionNode>(REGIONS[0]);
  const [activeTraffic, setActiveTraffic] = useState<boolean>(true);
  const [simulatedLoad, setSimulatedLoad] = useState<number>(12800);

  // Live jitter simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedLoad((prev) => prev + Math.floor((Math.random() - 0.5) * 240));
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl transition-all sm:p-8">
      {/* Background radial ambient glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 size-[360px] rounded-full bg-brand/10 blur-[100px] dark:bg-brand/15" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 size-[320px] rounded-full bg-info/10 blur-[90px] dark:bg-info/12" />

      {/* Card Header */}
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-2.5 py-0.5 text-[11px] font-semibold text-brand">
              <Radio className="size-3 animate-pulse" /> Global Telemetry Mesh
            </span>
            <span className="text-xs text-muted-foreground">9 Edge Worker Zones</span>
          </div>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Distributed Global Load Ingestion & Latency Profiling
          </h3>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Simulate requests originating from 9 worldwide locations. Benchmark regional CDN edge pops, TLS handshakes, and origin latency cliffs.
          </p>
        </div>

        {/* Global Live Stat Pill */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted/60 p-3 shadow-xs">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Ingested RPS
            </span>
            <p className="font-mono text-lg font-bold text-foreground">
              {simulatedLoad.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">RPS</span>
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Global P95
            </span>
            <p className="font-mono text-lg font-bold text-brand">
              34 <span className="text-xs font-normal text-muted-foreground">ms</span>
            </p>
          </div>
        </div>
      </div>

      {/* Vector Interactive Dotted World Map Graphic */}
      <div className="relative my-6 aspect-[1000/440] w-full select-none overflow-hidden rounded-2xl border border-border/80 bg-surface-muted/30">
        <svg
          viewBox="0 0 1000 440"
          className="size-full"
          role="img"
          aria-label="Interactive world map showing global API load test distribution"
        >
          <defs>
            {/* Grid dot pattern representing landmasses */}
            <pattern id="world-dot" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.1" className="fill-foreground/15 dark:fill-foreground/10" />
            </pattern>

            {/* Glowing gradient for active connection arcs */}
            <linearGradient id="arc-gradient-emerald" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#00d4ff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.4" />
            </linearGradient>

            <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Dotted Continental Landmass Shapes */}
          <rect width="1000" height="440" fill="url(#world-dot)" opacity="0.6" />

          {/* Ambient Continental Outlines (Subtle abstracted vector paths) */}
          <g className="fill-foreground/[0.04] stroke-foreground/[0.08] dark:fill-foreground/[0.03] dark:stroke-foreground/[0.06]" strokeWidth="0.75">
            {/* North America */}
            <path d="M 120 70 Q 210 60 290 90 Q 320 150 280 200 Q 230 220 180 180 Q 110 140 120 70 Z" />
            {/* South America */}
            <path d="M 280 230 Q 380 250 360 350 Q 320 410 290 380 Q 260 300 280 230 Z" />
            {/* Europe */}
            <path d="M 460 70 Q 560 65 570 140 Q 510 170 470 140 Q 440 110 460 70 Z" />
            {/* Africa */}
            <path d="M 470 180 Q 570 180 580 280 Q 530 360 480 300 Q 450 240 470 180 Z" />
            {/* Asia */}
            <path d="M 590 70 Q 820 60 880 140 Q 820 250 710 240 Q 640 210 590 140 Z" />
            {/* Australia */}
            <path d="M 780 280 Q 900 270 890 360 Q 820 380 770 340 Z" />
          </g>

          {/* Geodesic Bezier Flight Arcs between regions and Origin (IAD) */}
          {REGIONS.map((region) => {
            if (region.id === "us-east") return null; // Origin itself

            // Curve control point calculation
            const midX = (region.x + ORIGIN.x) / 2;
            const midY = Math.min(region.y, ORIGIN.y) - Math.abs(region.x - ORIGIN.x) * 0.22;
            const isSelected = selectedRegion.id === region.id;

            return (
              <g key={`arc-${region.id}`}>
                {/* Background soft arc */}
                <path
                  d={`M ${region.x} ${region.y} Q ${midX} ${midY} ${ORIGIN.x} ${ORIGIN.y}`}
                  fill="none"
                  className={cn(
                    "transition-all duration-300",
                    isSelected
                      ? "stroke-brand/80 stroke-[2.2]"
                      : "stroke-brand/25 dark:stroke-brand/20 stroke-[1.2]"
                  )}
                  strokeDasharray="4 4"
                />

                {/* Animated traveling data pulse */}
                {activeTraffic && (
                  <path
                    d={`M ${region.x} ${region.y} Q ${midX} ${midY} ${ORIGIN.x} ${ORIGIN.y}`}
                    fill="none"
                    stroke="url(#arc-gradient-emerald)"
                    strokeWidth={isSelected ? "2.5" : "1.8"}
                    strokeDasharray="16 120"
                    className="animate-dash"
                  />
                )}
              </g>
            );
          })}

          {/* Origin Server Beacon */}
          <g transform={`translate(${ORIGIN.x}, ${ORIGIN.y})`}>
            <circle r="12" className="fill-brand/20 animate-ping" />
            <circle r="6" className="fill-brand" filter="url(#glow-light)" />
            <circle r="3" className="fill-white" />
            <text x="0" y="-14" textAnchor="middle" className="fill-foreground font-mono text-[9px] font-bold">
              ORIGIN · IAD
            </text>
          </g>

          {/* Region Node Markers */}
          {REGIONS.map((region) => {
            const isSelected = selectedRegion.id === region.id;
            const isSafe = region.status === "safe";

            return (
              <g
                key={region.id}
                transform={`translate(${region.x}, ${region.y})`}
                onClick={() => setSelectedRegion(region)}
                className="cursor-pointer group"
              >
                {/* Hit area */}
                <circle r="18" fill="transparent" />

                {/* Pulse ring on active selection */}
                {isSelected && (
                  <circle
                    r="10"
                    className={cn(
                      "animate-ping",
                      isSafe ? "fill-brand/30" : "fill-warning/30"
                    )}
                  />
                )}

                {/* Main Node Point */}
                <circle
                  r={isSelected ? "5.5" : "4"}
                  className={cn(
                    "transition-all duration-200",
                    isSelected
                      ? isSafe
                        ? "fill-brand stroke-white stroke-2 shadow-lg"
                        : "fill-warning stroke-white stroke-2 shadow-lg"
                      : "fill-foreground/70 group-hover:fill-brand"
                  )}
                />

                {/* Node Label */}
                <text
                  x="0"
                  y="15"
                  textAnchor="middle"
                  className={cn(
                    "font-mono text-[9px] font-semibold transition-colors pointer-events-none",
                    isSelected
                      ? "fill-foreground font-bold"
                      : "fill-muted-foreground/75 group-hover:fill-foreground"
                  )}
                >
                  {region.code} · {region.latencyMs}ms
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Region Floating Live HUD */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between sm:left-4 sm:right-auto sm:bottom-4">
          <div className="pointer-events-auto rounded-2xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-xl transition-all">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand animate-pulse" />
              <span className="font-mono text-xs font-bold text-foreground">
                {selectedRegion.name} ({selectedRegion.country})
              </span>
              <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {selectedRegion.code}
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground">Edge Latency</span>
                <p className="font-mono text-sm font-bold text-brand">
                  {selectedRegion.latencyMs} ms
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Regional RPS</span>
                <p className="font-mono text-sm font-bold text-foreground">
                  {selectedRegion.rps} RPS
                </p>
              </div>
            </div>

            <div className="mt-2 border-t border-border pt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="size-3 text-brand" />
              <span>TLS 1.3 · HTTP/2 Multiplexed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Region Selector Pills Footer */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Inspect Regional Workers:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRegion(r)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-mono font-medium transition-all shadow-xs",
                selectedRegion.id === r.id
                  ? "border-brand bg-brand-subtle text-brand font-bold ring-2 ring-brand/20 dark:bg-brand/15"
                  : "border-border bg-card text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              )}
            >
              {r.code} ({r.latencyMs}ms)
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
