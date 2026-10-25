"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import type { GateVerdict } from "@/lib/gate";
import { SPRING_SOFT } from "@/lib/motion";
import { cn } from "@/lib/utils";

const STYLE = {
  PASS: { icon: CircleCheck, wrap: "border-brand/40 bg-brand-subtle", text: "text-success-text", glow: "var(--brand)", label: "PASS", sub: "Safe to deploy" },
  FAIL: { icon: CircleAlert, wrap: "border-destructive/40 bg-danger-subtle", text: "text-danger-text", glow: "var(--destructive)", label: "FAIL", sub: "Block this deploy" },
  INCONCLUSIVE: { icon: CircleHelp, wrap: "border-warning/40 bg-warning-subtle", text: "text-warning-text", glow: "var(--warning)", label: "INCONCLUSIVE", sub: "Not enough to decide" },
} as const;

/** The deployment-gate verdict. The stamp springs in whenever the verdict itself changes, not on every slider tick. */
export function GateVerdictBanner({ gate }: { gate: GateVerdict }) {
  const s = STYLE[gate.verdict];
  const Icon = s.icon;
  const reduce = useReducedMotion();
  return (
    <div role="status" aria-live="polite" className={cn("relative overflow-hidden rounded-2xl border p-5 sm:p-6", s.wrap)}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full opacity-25 blur-3xl" style={{ background: s.glow }} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <motion.div
          key={gate.verdict}
          initial={reduce ? false : { scale: 0.4, rotate: -14, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={SPRING_SOFT}
          className={cn("flex items-center gap-3", s.text)}
        >
          <Icon className="size-10" strokeWidth={1.75} aria-hidden />
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight">{s.label}</p>
            <p className="text-sm font-medium opacity-80">{s.sub}</p>
          </div>
        </motion.div>
        <ul className="min-w-0 flex-1 space-y-1 sm:border-l sm:border-current/15 sm:pl-6">
          {gate.reasons.map((r) => (
            <li key={r} className="text-[13px] leading-relaxed text-foreground">
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
