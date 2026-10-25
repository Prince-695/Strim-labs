"use client";

import { motion } from "framer-motion";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { SPRING_SNAPPY } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onValueChange: (v: T) => void;
  className?: string;
  /** "pill" = filled segmented control, "underline" = lined tabs, "rail" = vertical list */
  variant?: "pill" | "underline" | "rail";
  label?: string;
};

export function Tabs<T extends string>({ items, value, onValueChange, className, variant = "pill", label = "Sections" }: TabsProps<T>) {
  const group = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const vertical = variant === "rail";

  function onKeyDown(e: KeyboardEvent, index: number) {
    const next = vertical ? "ArrowDown" : "ArrowRight";
    const prev = vertical ? "ArrowUp" : "ArrowLeft";
    let target = -1;
    if (e.key === next) target = (index + 1) % items.length;
    else if (e.key === prev) target = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = items.length - 1;
    if (target >= 0) {
      e.preventDefault();
      refs.current[target]?.focus();
      onValueChange(items[target].value);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={cn(
        variant === "pill" && "inline-flex gap-1 rounded-xl border border-border bg-surface-muted p-1",
        variant === "underline" && "flex gap-6 border-b border-border",
        variant === "rail" && "flex flex-col gap-0.5",
        className,
      )}
    >
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative inline-flex items-center gap-2 text-sm font-medium transition-colors",
              variant === "pill" && "rounded-lg px-3.5 py-1.5",
              variant === "underline" && "pb-3",
              variant === "rail" && "rounded-lg px-3 py-2 text-left",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && variant !== "underline" && (
              <motion.span
                layoutId={`tab-bg-${group}`}
                transition={SPRING_SNAPPY}
                className={cn("absolute inset-0 -z-0 rounded-lg", variant === "pill" ? "bg-card shadow-sm ring-1 ring-border" : "bg-brand-subtle")}
              />
            )}
            {active && variant === "underline" && (
              <motion.span layoutId={`tab-line-${group}`} transition={SPRING_SNAPPY} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
            <span className="relative z-10 inline-flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
