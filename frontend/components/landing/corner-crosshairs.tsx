import * as React from "react"

interface CornerCrosshairsProps {
  className?: string
  offsetClass?: string
  colorClass?: string
}

export function CornerCrosshairs({
  className = "",
  offsetClass = "-top-2 -left-2 -right-2 -bottom-2",
  colorClass = "text-sand/40",
}: CornerCrosshairsProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-1.5 -left-1.5 font-mono text-[11px] leading-none transition-colors select-none ${colorClass} ${className}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-1.5 -right-1.5 font-mono text-[11px] leading-none transition-colors select-none ${colorClass} ${className}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-1.5 -left-1.5 font-mono text-[11px] leading-none transition-colors select-none ${colorClass} ${className}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-1.5 -bottom-1.5 font-mono text-[11px] leading-none transition-colors select-none ${colorClass} ${className}`}
      >
        +
      </span>
    </>
  )
}
