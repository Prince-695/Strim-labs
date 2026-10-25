import { cn } from "@/lib/utils";

/** Mark: The official STRIM emerald ribbon logo from favicon.ico. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/5 p-1 transition-transform dark:bg-white/5",
        className
      )}
    >
      <img
        src="/favicon.ico"
        alt="STRIM Labs logo"
        className="size-full object-contain"
        loading="eager"
      />
    </span>
  );
}

export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-md font-semibold tracking-light", dark ? "text-ink-foreground" : "text-foreground")}>
        Strim Labs
      </span>
    </span>
  );
}
