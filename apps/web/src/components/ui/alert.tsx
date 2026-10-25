import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: { icon: Info, cls: "border-info/25 bg-info-subtle text-info" },
  success: { icon: CheckCircle2, cls: "border-brand/30 bg-brand-subtle text-success-text" },
  warning: { icon: AlertTriangle, cls: "border-warning/35 bg-warning-subtle text-warning-text" },
  danger: { icon: OctagonAlert, cls: "border-destructive/35 bg-danger-subtle text-danger-text" },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones; title?: string; action?: ReactNode }) {
  const { icon: Icon, cls } = tones[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", cls, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-[13px] leading-relaxed opacity-90">{children}</div>
      </div>
      {action}
    </div>
  );
}
