import { isValidElement, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionConfig = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "secondary";
};

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode | ComponentType<{ className?: string }>;
  action?: ReactNode | ActionConfig;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  let renderedIcon: ReactNode;
  if (isValidElement(icon)) {
    renderedIcon = icon;
  } else if (typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon)) {
    const IconComponent = icon as ComponentType<{ className?: string }>;
    renderedIcon = <IconComponent className="size-6" />;
  } else {
    renderedIcon = <Inbox className="size-6" />;
  }

  let renderedAction: ReactNode = null;
  if (isValidElement(action)) {
    renderedAction = action;
  } else if (action && typeof action === "object" && "label" in action) {
    const cfg = action as ActionConfig;
    if (cfg.href) {
      renderedAction = (
        <Button asChild size="sm">
          <Link href={cfg.href}>{cfg.label}</Link>
        </Button>
      );
    } else {
      renderedAction = (
        <Button size="sm" onClick={cfg.onClick}>
          {cfg.label}
        </Button>
      );
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center sm:p-12",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground mb-4">
        {renderedIcon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {renderedAction && <div className="mt-6">{renderedAction}</div>}
    </div>
  );
}
