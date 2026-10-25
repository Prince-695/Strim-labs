"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { SPRING_SNAPPY } from "@/lib/motion";
import { profileLabel } from "@/lib/format";
import type { Preset } from "@/lib/presets";
import { cn } from "@/lib/utils";
import { TiltCard } from "../fx/tilt-card";

const TONE = {
  emerald: { ring: "ring-brand", chip: "bg-brand-subtle text-brand-strong dark:text-brand", stroke: "var(--brand)", wash: "from-brand/10" },
  cyan: { ring: "ring-cyan-500", chip: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", stroke: "#06b6d4", wash: "from-cyan-500/10" },
  amber: { ring: "ring-warning", chip: "bg-warning-subtle text-warning-text", stroke: "var(--warning)", wash: "from-warning/10" },
  rose: { ring: "ring-rose-500", chip: "bg-danger-subtle text-danger-text", stroke: "#f43f5e", wash: "from-rose-500/10" },
} as const;

/** Tiny load-shape glyph so each preset's curve is visible, not just named. */
function Shape({ profile, id, stroke }: { profile: Preset["profile"]; id: Preset["id"]; stroke: string }) {
  const d =
    profile === "SUSTAINED"
      ? "M2 20 H12 L16 8 H78 L82 20 H98"
      : profile === "SPIKE"
        ? "M2 20 H30 L32 6 H62 L64 20 H98"
        : id === "breaking"
          ? "M2 20 C25 20 40 18 60 12 S85 3 98 2"
          : "M2 20 L98 6";
  return (
    <svg viewBox="0 0 100 24" className="h-6 w-full" aria-hidden preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PresetCard({ preset, selected, onSelect, disabled }: { preset: Preset; selected: boolean; onSelect: () => void; disabled?: boolean }) {
  const tone = TONE[preset.tone];
  return (
    <TiltCard max={5} lift={6} className="rounded-2xl">
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card p-4 text-left transition-[box-shadow,border-color] duration-200 disabled:opacity-60",
          selected ? cn("border-transparent ring-2", tone.ring) : "border-border hover:border-input",
        )}
      >
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-80", tone.wash)} aria-hidden />
        <div className="relative flex items-start justify-between gap-2" style={{ transform: "translateZ(18px)" }}>
          <h3 className="text-[15px] font-semibold tracking-tight">{preset.name}</h3>
          {selected && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_SNAPPY} className={cn("grid size-5 place-items-center rounded-full", tone.chip)}>
              <Check className="size-3" />
            </motion.span>
          )}
        </div>
        <p className="relative mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground" style={{ transform: "translateZ(10px)" }}>
          {preset.blurb}
        </p>
        <div className="relative mt-3" style={{ transform: "translateZ(14px)" }}>
          <Shape profile={preset.profile} id={preset.id} stroke={tone.stroke} />
        </div>
        <div className="relative mt-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
          <span className={cn("rounded-md px-1.5 py-0.5", tone.chip)}>{preset.concurrency} VUs</span>
          <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-muted-foreground">{preset.durationSec}s</span>
          <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-muted-foreground">{preset.curveLabel || profileLabel(preset.profile)}</span>
        </div>
      </button>
    </TiltCard>
  );
}
