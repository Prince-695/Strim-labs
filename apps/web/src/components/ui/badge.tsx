import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-muted text-muted-foreground",
        brand: "border-brand/25 bg-brand-subtle text-brand-strong dark:text-brand",
        success: "border-brand/25 bg-brand-subtle text-success-text",
        warning: "border-warning/30 bg-warning-subtle text-warning-text",
        danger: "border-destructive/30 bg-danger-subtle text-danger-text",
        info: "border-info/25 bg-info-subtle text-info",
        outline: "border-input bg-transparent text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  variant?: "default" | "secondary" | "destructive" | "outline" | BadgeTone;
}

const variantToTone: Record<string, BadgeTone> = {
  default: "brand",
  secondary: "neutral",
  destructive: "danger",
  outline: "outline",
};

export function Badge({ className, tone, variant, ...props }: BadgeProps) {
  const resolvedTone: BadgeTone = tone || (variant && variantToTone[variant] ? variantToTone[variant] : (variant as BadgeTone)) || "neutral";
  return <span className={cn(badgeVariants({ tone: resolvedTone }), className)} {...props} />;
}
