import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ShieldCheck, Layers } from "lucide-react"
import { AuthGuard } from "@/components/auth/auth-guard"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col justify-between bg-background text-foreground selection:bg-brand/20 selection:text-sand">
        {/* Header */}
        <header className="flex w-full items-center justify-between border-b border-border-subtle/50 px-6 py-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface p-1 transition-colors group-hover:border-brand">
              <Image
                src="/logo.png"
                alt="Strim Labs Logo"
                width={28}
                height={28}
                priority
                className="size-full object-contain"
              />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              STRIM<span className="text-brand">.</span>
            </span>
            <span className="ml-1 hidden border-l border-border-subtle pl-2.5 font-mono text-[11px] text-foreground-subtle sm:inline-block">
              ONBOARDING
            </span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
            <Layers className="size-3.5 text-brand" />
            <span>Tenant Provisioning</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-10">
          <div className="w-full max-w-lg">{children}</div>
        </main>

        {/* Footer */}
        <footer className="flex w-full items-center justify-between border-t border-border-subtle/50 px-6 py-4 font-mono text-xs text-foreground-subtle">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand" />
            <span>Multi-Tenant Isolated Data Plane</span>
          </div>
          <p className="text-[11px]">STRIM Labs v1.0 Production Engine</p>
        </footer>
      </div>
    </AuthGuard>
  )
}
