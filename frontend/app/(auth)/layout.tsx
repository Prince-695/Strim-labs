import * as React from "react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative isolate flex min-h-screen w-full items-center justify-center bg-background p-4 selection:bg-brand/30 selection:text-foreground">
      {/* Ambient background glow matching STRIM theme */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
        <div className="size-[580px] rounded-full bg-brand/5 blur-[140px]" />
        <div className="size-[380px] rounded-full bg-sand/5 blur-[120px]" />
      </div>
      {children}
    </div>
  )
}
