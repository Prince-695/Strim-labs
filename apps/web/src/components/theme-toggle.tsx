"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("size-8 rounded-full border border-border/60 bg-secondary/30", className)} />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
      className={cn(
        "size-8 rounded-full border border-border/80 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer",
        className
      )}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400 rotate-0 scale-100 transition-transform duration-200" />
      ) : (
        <Moon className="size-4 text-slate-700 rotate-0 scale-100 transition-transform duration-200" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
