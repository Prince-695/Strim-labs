import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: React.ReactNode | BreadcrumbItem[]
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  children,
  className,
}: PageHeaderProps) {
  const renderBreadcrumbs = () => {
    if (!breadcrumbs) return null
    if (Array.isArray(breadcrumbs)) {
      return (
        <div className="flex items-center gap-2 text-xs font-mono text-foreground-subtle">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )
    }
    return <div className="text-xs font-mono text-foreground-subtle">{breadcrumbs}</div>
  }

  return (
    <div className={cn("border-b border-border/80 pb-5 mb-6 space-y-4", className)}>
      {renderBreadcrumbs()}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl font-heading">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-foreground-muted max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
      </div>

      {children && <div className="pt-2">{children}</div>}
    </div>
  )
}
