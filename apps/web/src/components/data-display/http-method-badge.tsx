import { cn } from "@/lib/utils";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | string;

interface HttpMethodBadgeProps {
  method: HttpMethod;
  className?: string;
  size?: "sm" | "md";
}

const methodStyles: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  DELETE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  PATCH: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  HEAD: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  OPTIONS: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
};

export function HttpMethodBadge({
  method,
  className,
  size = "sm",
}: HttpMethodBadgeProps) {
  const upper = (method || "GET").toUpperCase();
  const colorClass = methodStyles[upper] || "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-semibold tracking-wider border rounded",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        colorClass,
        className
      )}
    >
      {upper}
    </span>
  );
}
