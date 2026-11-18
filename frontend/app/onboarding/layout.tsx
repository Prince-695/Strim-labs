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
      <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-brand/20 selection:text-sand">
        {/* Header */}
        <header className="w-full border-b border-border-subtle/50 px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center p-1 overflow-hidden group-hover:border-brand transition-colors">
              <Image
                src="/logo.png"
                alt="Strim Labs Logo"
                width={28}
                height={28}
                priority
                className="size-full object-contain"
              />
            </div>
            <span className="font-heading font-bold text-lg tracking-tight text-foreground">
              STRIM<span className="text-brand">.</span>
            </span>
            <span className="hidden sm:inline-block font-mono text-[11px] text-foreground-subtle border-l border-border-subtle pl-2.5 ml-1">
              ONBOARDING
            </span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
            <Layers className="size-3.5 text-brand" />
            <span>Tenant Provisioning</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
          <div className="w-full max-w-lg">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-border-subtle/50 px-6 py-4 flex items-center justify-between font-mono text-xs text-foreground-subtle">
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
