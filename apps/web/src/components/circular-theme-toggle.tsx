"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { SPRING_SNAPPY } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function CircularThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative grid size-8.5 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-sm transition-all hover:bg-surface-muted hover:border-brand/40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <motion.div
        key={isDark ? "dark" : "light"}
        initial={{ rotate: -35, scale: 0.7, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 35, scale: 0.7, opacity: 0 }}
        transition={SPRING_SNAPPY}
        className="grid place-items-center"
      >
        {isDark ? (
          <Sun className="size-4 text-warning" aria-hidden />
        ) : (
          <Moon className="size-4 text-foreground/80" aria-hidden />
        )}
      </motion.div>
    </button>
  );
}
