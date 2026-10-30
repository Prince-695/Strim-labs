import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string | ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  action,
  badge,
  className,
}: PageHeaderProps) {
  const resolvedActions = actions ?? action;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-6 pt-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 mb-6",
        className
      )}
    >
      <div className="space-y-1">
        {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {resolvedActions && <div className="flex items-center gap-2.5 shrink-0">{resolvedActions}</div>}
    </div>
  );
}
