import * as React from "react"
import { ShieldCheck, Lock, EyeOff, FileCode } from "lucide-react"

export function SecurityTrust() {
  return (
    <section id="security" className="py-20 lg:py-28 border-t border-border bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-mono text-sand mb-4">
            <Lock className="size-3.5" />
            <span>RESPONSIBLE TESTING & HARDENED DEFENSE</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl font-heading">
            Safety and authorization by design
          </h2>
          <p className="mt-4 text-sm sm:text-base text-foreground-muted leading-relaxed">
            High-volume load generation requires rigorous safety guardrails. STRIM enforces target ownership
            and cryptographic network verification before a single stress packet is dispatched.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-raised border border-border-subtle text-success">
              <ShieldCheck className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground font-heading">
              Mandatory DNS Proof
            </h3>
            <p className="mt-2 text-xs text-foreground-muted leading-relaxed">
              Domain ownership must be proven via unique DNS TXT challenges before load generation is authorized.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-raised border border-border-subtle text-sand">
              <Lock className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground font-heading">
              Netguard SSRF Protection
            </h3>
            <p className="mt-2 text-xs text-foreground-muted leading-relaxed">
              Rigorous IP guards prevent loopback, RFC 1918 private subnets, and AWS/GCP cloud metadata scraping.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-raised border border-border-subtle text-brand">
              <EyeOff className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground font-heading">
              Secret Masking Everywhere
            </h3>
            <p className="mt-2 text-xs text-foreground-muted leading-relaxed">
              API tokens, webhook signing keys, and Authorization headers are masked in audit logs and API responses.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-surface-raised border border-border-subtle text-info">
              <FileCode className="size-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground font-heading">
              Immutable Audit Logs
            </h3>
            <p className="mt-2 text-xs text-foreground-muted leading-relaxed">
              Every target creation, verification attempt, test execution, and member role modification is permanently recorded.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
