import { isValidElement, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  title: string;
  value: string | number | ReactNode;
  subtitle?: string | ReactNode;
  helperText?: string | ReactNode;
  icon?: ReactNode | ComponentType<{ className?: string }>;
  badge?: ReactNode;
  trend?: {
    value: string | number;
    positive?: boolean;
    neutral?: boolean;
  };
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  helperText,
  icon,
  badge,
  trend,
  isLoading,
  className,
  onClick,
}: MetricCardProps) {
  let renderedIcon: ReactNode = null;
  if (isValidElement(icon)) {
    renderedIcon = icon;
  } else if (typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon)) {
    const IconComponent = icon as ComponentType<{ className?: string }>;
    renderedIcon = <IconComponent className="size-4" />;
  } else if (icon) {
    renderedIcon = icon as ReactNode;
  }

  const resolvedSubtitle = subtitle ?? helperText;
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-xs transition-[border-color,box-shadow]",
        onClick && "cursor-pointer hover:border-brand/40 hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {renderedIcon && <div className="text-muted-foreground">{renderedIcon}</div>}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {value}
          </div>
        )}
        {badge}
      </div>

      {(resolvedSubtitle || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                "font-mono font-medium",
                trend.neutral
                  ? "text-muted-foreground"
                  : trend.positive
                  ? "text-emerald-500"
                  : "text-rose-500"
              )}
            >
              {trend.value}
            </span>
          )}
          {resolvedSubtitle && <span>{resolvedSubtitle}</span>}
        </div>
      )}
    </div>
  );
}
