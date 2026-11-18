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
        className={`absolute -top-1.5 -left-1.5 font-mono text-[11px] leading-none select-none pointer-events-none transition-colors ${colorClass} ${className}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`absolute -top-1.5 -right-1.5 font-mono text-[11px] leading-none select-none pointer-events-none transition-colors ${colorClass} ${className}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`absolute -bottom-1.5 -left-1.5 font-mono text-[11px] leading-none select-none pointer-events-none transition-colors ${colorClass} ${className}`}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={`absolute -bottom-1.5 -right-1.5 font-mono text-[11px] leading-none select-none pointer-events-none transition-colors ${colorClass} ${className}`}
      >
        +
      </span>
    </>
  )
}
