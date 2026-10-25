import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./ui/tooltip";

export type MetricTone = "neutral" | "brand" | "warning" | "danger";

const toneText: Record<MetricTone, string> = {
  neutral: "text-foreground",
  brand: "text-brand-strong dark:text-brand",
  warning: "text-warning-text",
  danger: "text-danger-text",
};

export function MetricCard({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  definition,
  className,
  icon,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: MetricTone;
  /** Plain-language metric definition shown in a tooltip. */
  definition?: string;
  className?: string;
  icon?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {label}
          {definition && (
            <Tooltip content={definition}>
              <button type="button" aria-label={`What is ${label}?`} className="rounded text-muted-foreground/70 hover:text-foreground">
                <Info className="size-3.5" />
              </button>
            </Tooltip>
          )}
        </span>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("font-mono font-semibold leading-none tracking-tight tnum", size === "lg" ? "text-4xl" : "text-[26px]", toneText[tone])}>
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
