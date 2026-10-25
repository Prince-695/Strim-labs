"use client";

import createGlobe from "cobe";
import { Activity, Globe as GlobeIcon, Radio, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "../theme-provider";

interface RegionNode {
  id: string;
  name: string;
  country: string;
  code: string;
  location: [number, number]; // [lat, lon]
  latencyMs: number;
  rps: number;
  status: "safe" | "knee";
}

const ORIGIN_COORDS: [number, number] = [38.95, -77.45]; // IAD (Virginia)

const REGIONS: RegionNode[] = [
  { id: "us-west", name: "US West", country: "San Francisco", code: "SFO", location: [37.77, -122.41], latencyMs: 14, rps: 1850, status: "safe" },
  { id: "us-east", name: "US East (Origin)", country: "Virginia", code: "IAD", location: [38.95, -77.45], latencyMs: 22, rps: 2420, status: "safe" },
  { id: "eu-west", name: "EU West", country: "London", code: "LHR", location: [51.50, -0.12], latencyMs: 28, rps: 1940, status: "safe" },
  { id: "eu-central", name: "EU Central", country: "Frankfurt", code: "FRA", location: [50.11, 8.68], latencyMs: 31, rps: 1680, status: "safe" },
  { id: "ap-south", name: "AP South", country: "Mumbai", code: "BOM", location: [19.07, 72.87], latencyMs: 42, rps: 1210, status: "knee" },
  { id: "ap-southeast", name: "AP Southeast", country: "Singapore", code: "SIN", location: [1.35, 103.81], latencyMs: 54, rps: 1450, status: "safe" },
  { id: "ap-northeast", name: "AP East", country: "Tokyo", code: "NRT", location: [35.67, 139.65], latencyMs: 68, rps: 1780, status: "safe" },
  { id: "sa-east", name: "SA East", country: "São Paulo", code: "GRU", location: [-23.55, -46.63], latencyMs: 82, rps: 640, status: "safe" },
  { id: "oc-east", name: "Oceania", country: "Sydney", code: "SYD", location: [-33.86, 151.20], latencyMs: 95, rps: 820, status: "knee" },
];

export function WorldGlobe3D() {
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [selectedRegion, setSelectedRegion] = useState<RegionNode>(REGIONS[0]);
  const [simulatedLoad, setSimulatedLoad] = useState<number>(12840);
  const phiRef = useRef(0);
  const thetaRef = useRef(0.2);
  const targetPhiRef = useRef<number | null>(null);

  // Periodic simulated RPS jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedLoad((prev) => prev + Math.floor((Math.random() - 0.48) * 160));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // When a user selects a region, smoothly animate globe rotation to center it
  function handleSelectRegion(region: RegionNode) {
    setSelectedRegion(region);
    const targetPhi = -(region.location[1] * Math.PI) / 180 + Math.PI / 2;
    targetPhiRef.current = targetPhi;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use square bounding dimension for perfect 1:1 circular rendering
    let size = canvas.offsetWidth;
    const onResize = () => {
      if (canvas) {
        size = canvas.offsetWidth;
      }
    };
    window.addEventListener("resize", onResize);
    onResize();

    // 3D arcs connecting edge regions to Origin (IAD)
    const arcs = REGIONS.filter((r) => r.id !== "us-east").map((r) => ({
      from: r.location,
      to: ORIGIN_COORDS,
      color: (r.id === selectedRegion.id
        ? (isDark ? [0.0, 1.0, 0.6] : [0.0, 0.85, 0.45])
        : (isDark ? [0.0, 0.75, 0.42] : [0.1, 0.7, 0.38])) as [number, number, number],
    }));

    // 3D markers for all edge regions
    const markers = REGIONS.map((r) => ({
      location: r.location,
      size: r.id === "us-east" ? 0.08 : r.id === selectedRegion.id ? 0.07 : 0.045,
      color: (r.id === selectedRegion.id
        ? [0.0, 1.0, 0.6]
        : r.id === "us-east"
        ? (isDark ? [0.0, 0.9, 1.0] : [0.0, 0.7, 0.95])
        : [0.0, 0.85, 0.45]) as [number, number, number],
    }));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: isDark ? 1 : 0,
      diffuse: isDark ? 1.4 : 1.25,
      mapSamples: 16000,
      mapBrightness: isDark ? 5.5 : 3.0,
      baseColor: isDark ? [0.06, 0.09, 0.13] : [0.94, 0.96, 0.95],
      markerColor: isDark ? [0.0, 0.9, 0.46] : [0.0, 0.79, 0.41],
      glowColor: isDark ? [0.0, 0.55, 0.28] : [0.82, 0.94, 0.88],
      markers,
      arcs,
      arcColor: isDark ? [0.0, 0.85, 0.45] : [0.0, 0.75, 0.4],
      arcWidth: 0.6,
      arcHeight: 0.35,
      markerElevation: 0.03,
    });

    let animationFrameId: number;

    const render = () => {
      // Smoothly interpolate to target angle when region is clicked
      if (targetPhiRef.current !== null) {
        const diff = targetPhiRef.current - phiRef.current;
        const normDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(normDiff) < 0.01) {
          phiRef.current = targetPhiRef.current;
          targetPhiRef.current = null;
        } else {
          phiRef.current += normDiff * 0.08;
        }
      } else if (!pointerInteracting.current) {
        phiRef.current += 0.003;
      }

      globe.update({
        phi: phiRef.current + pointerInteractionMovement.current,
        theta: thetaRef.current,
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [selectedRegion, isDark]);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all sm:p-8">
      {/* Background ambient mesh glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 size-[380px] rounded-full bg-brand/15 blur-[110px] dark:bg-brand/20" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 size-[320px] rounded-full bg-info/12 blur-[100px] dark:bg-info/15" />

      {/* Card Header */}
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-2.5 py-0.5 text-[11px] font-semibold text-brand">
              <Radio className="size-3 animate-pulse" /> 3D Global Telemetry Mesh
            </span>
            <span className="text-xs text-muted-foreground">9 Edge PoP Zones</span>
          </div>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Distributed Global Ingestion &amp; 3D Worker Mesh
          </h3>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Interactive WebGL 3D globe. Drag to rotate or click a regional worker to inspect edge hops, TLS multiplexing, and origin latency.
          </p>
        </div>

        {/* Global Live Stats Pill */}
        <div className="flex items-center gap-3 self-start rounded-2xl border border-border bg-surface-muted/60 p-3 shadow-xs sm:self-auto">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Ingested RPS
            </span>
            <p className="font-mono text-base font-bold text-foreground sm:text-lg">
              {simulatedLoad.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">RPS</span>
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Global Tail (P95)
            </span>
            <p className="font-mono text-base font-bold text-brand sm:text-lg">
              34 <span className="text-xs font-normal text-muted-foreground">ms</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3D WebGL Globe Centered Viewport */}
      <div className="relative my-4 flex w-full items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-surface-muted/30 via-card to-surface-muted/30 py-6 min-h-[380px] sm:min-h-[440px]">
        {/* Helper Drag Overlay Indicator */}
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-border/80 bg-card/85 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur-md shadow-xs">
          <GlobeIcon className="size-3 text-brand" />
          <span>Drag to spin 3D globe</span>
        </div>

        {/* Centered Canvas Container (Exact 1:1 Aspect Ratio) */}
        <div className="relative flex aspect-square w-full max-w-[360px] sm:max-w-[420px] md:max-w-[460px] items-center justify-center mx-auto">
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
              canvasRef.current?.classList.add("cursor-grabbing");
            }}
            onPointerUp={() => {
              pointerInteracting.current = null;
              canvasRef.current?.classList.remove("cursor-grabbing");
            }}
            onPointerOut={() => {
              pointerInteracting.current = null;
              canvasRef.current?.classList.remove("cursor-grabbing");
            }}
            onMouseMove={(e) => {
              if (pointerInteracting.current !== null) {
                const delta = e.clientX - pointerInteracting.current;
                pointerInteractionMovement.current = delta * 0.005;
              }
            }}
            onTouchMove={(e) => {
              if (pointerInteracting.current !== null && e.touches[0]) {
                const delta = e.touches[0].clientX - pointerInteracting.current;
                pointerInteractionMovement.current = delta * 0.005;
              }
            }}
            className="size-full cursor-grab transition-opacity duration-500 will-change-transform"
            style={{ width: "100%", height: "100%", contain: "layout paint size" }}
          />
        </div>

        {/* Selected Region Live HUD Floating Pill */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[270px] sm:bottom-4 sm:left-4">
          <div className="pointer-events-auto rounded-2xl border border-border/90 bg-card/90 p-3.5 shadow-xl backdrop-blur-xl transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand animate-pulse" />
                <span className="font-mono text-xs font-bold text-foreground truncate">
                  {selectedRegion.name}
                </span>
              </div>
              <span className="rounded bg-brand-subtle px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand">
                {selectedRegion.code}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground">Edge Latency</span>
                <p className="font-mono text-sm font-bold text-brand">
                  {selectedRegion.latencyMs} ms
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Throughput</span>
                <p className="font-mono text-sm font-bold text-foreground">
                  {selectedRegion.rps} RPS
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3 text-brand" />
                <span>TLS 1.3 · HTTP/2</span>
              </span>
              <span className="font-mono text-brand font-medium">Worker $\rightarrow$ IAD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Region Selector Pills Footer */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rotate &amp; Inspect Worker Node:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelectRegion(r)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-mono font-medium transition-all shadow-xs",
                selectedRegion.id === r.id
                  ? "border-brand bg-brand-subtle text-brand font-bold ring-2 ring-brand/30 dark:bg-brand/15"
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
