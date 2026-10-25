"use client";

import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useId } from "react";
import { SPRING_SNAPPY } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "./theme-provider";

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** 3-way System / Light / Dark switch with a sliding indicator. */
export function ThemeToggle({ className, dark }: { className?: string; dark?: boolean }) {
  const { theme, setTheme } = useTheme();
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex rounded-lg border p-0.5",
        dark ? "border-ink-border bg-ink-raised" : "border-border bg-surface-muted",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative grid size-7 place-items-center rounded-md transition-colors",
              active ? (dark ? "text-ink-foreground" : "text-foreground") : dark ? "text-ink-muted hover:text-ink-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`theme-pill-${id}`}
                transition={SPRING_SNAPPY}
                className={cn("absolute inset-0 rounded-md shadow-sm", dark ? "bg-white/10" : "bg-card ring-1 ring-border")}
              />
            )}
            <Icon className="relative size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
