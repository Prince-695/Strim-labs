import * as React from "react"
import Link from "next/link"

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background py-14 text-xs font-mono">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand Col */}
          <div className="space-y-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-surface">
                <span className="font-mono text-xs font-bold text-brand">S</span>
                <span className="font-mono text-xs font-bold text-sand">L</span>
              </div>
              <span className="font-bold tracking-tight text-foreground text-sm font-sans">
                STRIM LABS
              </span>
            </Link>
            <p className="text-xs text-foreground-muted leading-relaxed font-sans max-w-sm">
              Production-grade API load testing, real-time observability, and capacity analysis platform.
            </p>
            <p className="text-[11px] text-foreground-subtle">
              Find your API&apos;s breaking point before production does.
            </p>
          </div>

          {/* Product Col */}
          <div className="space-y-3">
            <p className="font-semibold text-foreground tracking-wider uppercase text-[11px]">
              Platform
            </p>
            <ul className="space-y-2 text-foreground-muted font-sans text-xs">
              <li>
                <Link href="/dashboard" className="hover:text-foreground">
                  Load Runner
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-foreground">
                  Live Cockpit
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-foreground">
                  Capacity Analysis
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-foreground">
                  Regression Comparison
                </Link>
              </li>
            </ul>
          </div>

          {/* API & Docs Col */}
          <div className="space-y-3">
            <p className="font-semibold text-foreground tracking-wider uppercase text-[11px]">
              Developers
            </p>
            <ul className="space-y-2 text-foreground-muted font-sans text-xs">
              <li>
                <a
                  href="https://strim-labs.onrender.com/swagger/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Swagger OpenAPI 3.0
                </a>
              </li>
              <li>
                <a
                  href="https://strim-labs.onrender.com/healthz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  System Liveness Probe
                </a>
              </li>
              <li>
                <a
                  href="https://strim-labs.onrender.com/metrics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Prometheus Metrics
                </a>
              </li>
            </ul>
          </div>

          {/* Security & System */}
          <div className="space-y-3">
            <p className="font-semibold text-foreground tracking-wider uppercase text-[11px]">
              Security
            </p>
            <ul className="space-y-2 text-foreground-muted font-sans text-xs">
              <li>
                <span className="text-foreground-subtle">DNS TXT Verification</span>
              </li>
              <li>
                <span className="text-foreground-subtle">Netguard SSRF Defense</span>
              </li>
              <li>
                <span className="text-foreground-subtle">Argon2 Password Hashing</span>
              </li>
              <li>
                <span className="text-foreground-subtle">AES-256 Webhook Secrets</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between border-t border-border-subtle pt-6 text-[11px] text-foreground-subtle">
          <p>© {new Date().getFullYear()} STRIM Labs. All rights reserved.</p>
          <p className="mt-2 sm:mt-0 font-sans">
            Engineered for high-concurrency API performance decisions.
          </p>
        </div>
      </div>
    </footer>
  )
}
