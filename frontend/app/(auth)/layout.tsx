import * as React from "react"
import Link from "next/link"
import { ShieldCheck, Activity } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-brand/20 selection:text-sand">
      {/* Top Header */}
      <header className="w-full border-b border-border-subtle/50 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center font-mono font-bold text-sand group-hover:border-brand transition-colors">
            S
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-foreground">
            STRIM<span className="text-brand">.</span>
          </span>
          <span className="hidden sm:inline-block font-mono text-[11px] text-foreground-subtle border-l border-border-subtle pl-2.5 ml-1">
            API BREAKING POINT PLATFORM
          </span>
        </Link>

        <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
          <Activity className="size-3.5 text-brand animate-pulse" />
          <span className="hidden sm:inline">Engine Status:</span>
          <span className="text-success font-medium">99.98% Healthy</span>
        </div>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Security Footer */}
      <footer className="w-full border-t border-border-subtle/50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs text-foreground-subtle">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand" />
          <span>SSRF Netguard Protected • TLS 1.3 Strict • Immutable Audit Trail</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link href="/docs" className="hover:text-foreground transition-colors">API Docs</Link>
        </div>
      </footer>
    </div>
  )
}
