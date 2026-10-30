import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading telemetry & data...",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center text-muted-foreground",
        className
      )}
    >
      <Loader2 className="size-8 animate-spin text-brand mb-3" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
