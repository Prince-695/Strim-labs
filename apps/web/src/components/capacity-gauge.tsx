"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fmtRps, isNum } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import type { BreakingPointAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  breakingPoint?: BreakingPointAnalysis | null;
  /** Where this test's throughput landed. */
  currentRps?: number | null;
  currentLabel?: string;
  className?: string;
  /** Marks the gauge as example data (marketing preview). */
  example?: boolean;
};

/**
 * 3-zone capacity spectrum: Safe band → Saturation knee → Breaking cliff.
 * Zones are only drawn when the analysis supplies the numbers; otherwise it says so instead of inventing them.
 */
export function CapacityGauge({ breakingPoint: bp, currentRps, currentLabel = "This run", className, example }: Props) {
  const reduce = useReducedMotion();

  if (!bp || !isNum(bp.sustainableRps) || !isNum(bp.kneeRps) || !isNum(bp.failureRps)) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border bg-surface-muted/50 p-5", className)}>
        <div className="h-6 rounded-lg bg-border/60" />
        <p className="mt-3 text-sm text-muted-foreground">
          Capacity zones aren't available for this run. Insufficient evidence to place a safe band, knee or cliff.
        </p>
      </div>
    );
  }

  const sustainable = Math.max(0, bp.sustainableRps);
  const knee = Math.max(sustainable, bp.kneeRps);
  const failure = Math.max(knee, bp.failureRps);
  const max = Math.max(failure * 1.12, isNum(currentRps) ? currentRps * 1.08 : 0, 1);

  const safeW = (sustainable / max) * 100;
  const kneeW = ((knee - sustainable) / max) * 100;
  const cliffW = 100 - safeW - kneeW;
  const pin = isNum(currentRps) ? Math.min(100, (currentRps / max) * 100) : null;

  const summary = `Safe band up to ${fmtRps(sustainable)} RPS, saturation knee at ${fmtRps(knee)} RPS, breaking cliff from ${fmtRps(failure)} RPS.${
    isNum(currentRps) ? ` ${currentLabel} reached ${fmtRps(currentRps)} RPS.` : ""
  }`;

  const seg = (w: number, delay: number) => ({
    initial: reduce ? false : ({ width: 0 } as const),
    animate: { width: `${w}%` },
    transition: { duration: 0.9, delay, ease: EASE_OUT },
  });

  return (
    <div className={cn("space-y-3", className)}>
      <div role="img" aria-label={summary} className="relative">
        <div className="relative flex h-9 overflow-hidden rounded-xl border border-border bg-secondary">
          <motion.div {...seg(safeW, 0)} className="flex h-full items-center border-r border-brand/50 bg-brand/20 px-3">
            {safeW > 13 && <span className="truncate text-[11px] font-semibold text-success-text">Safe band</span>}
          </motion.div>
          <motion.div {...seg(kneeW, 0.15)} className="flex h-full items-center border-r border-warning/60 bg-warning/20 px-3">
            {kneeW > 15 && <span className="truncate text-[11px] font-semibold text-warning-text">Saturation knee</span>}
          </motion.div>
          <motion.div {...seg(cliffW, 0.3)} className="flex h-full items-center bg-destructive/20 px-3">
            {cliffW > 14 && <span className="truncate text-[11px] font-semibold text-danger-text">Breaking cliff</span>}
          </motion.div>
        </div>

        {pin !== null && (
          <motion.div
            initial={reduce ? false : { left: "0%", opacity: 0 }}
            animate={{ left: `${pin}%`, opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.5, ease: EASE_OUT }}
            className="absolute -top-2 bottom-[-6px] z-10 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          >
            <span className="absolute -top-0.5 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-card bg-foreground shadow" />
            <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 font-mono text-[10px] font-medium text-background">
              {currentLabel} · {fmtRps(currentRps)}
            </span>
          </motion.div>
        )}
      </div>

      <dl className={cn("grid grid-cols-3 gap-3", pin !== null && "pt-5")}>
        <Callout color="bg-brand" label="Sustainable" value={sustainable} />
        <Callout color="bg-warning" label="Knee" value={knee} />
        <Callout color="bg-destructive" label="Failure" value={failure} />
      </dl>
      {example && <p className="text-[11px] text-muted-foreground">Example data</p>}
    </div>
  );
}

function Callout({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-2 rounded-full", color)} aria-hidden />
        {label} RPS
      </dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold tnum">{fmtRps(value)}</dd>
    </div>
  );
}
