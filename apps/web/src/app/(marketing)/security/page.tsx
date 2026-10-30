import type { Metadata } from "next";
import { ShieldCheck, Lock, Key, FileText, Database, Server } from "lucide-react";

export const metadata: Metadata = {
  title: "Security & Trust Architecture — STRIM Labs",
  description: "Comprehensive security architecture, tenant isolation, encryption, and audit controls in STRIM Labs.",
};

const SECURITY_ITEMS = [
  {
    icon: Database,
    title: "Multi-Tenant Data Isolation",
    description:
      "Every organization maintains strict tenant boundary segregation enforced at the database and query level via organization foreign keys and tenant-scoping middleware.",
  },
  {
    icon: Lock,
    title: "Encryption at Rest and in Transit",
    description:
      "All traffic to STRIM Labs APIs, SDK ingestion gateways, and dashboards is encrypted with TLS 1.3. Databases and persistent artifacts are encrypted using AES-256.",
  },
  {
    icon: Key,
    title: "Scoped API Keys & Key Rotation",
    description:
      "API keys utilize granular least-privilege permission scopes (e.g. telemetry:write, load-test:write). Ingestion keys can be rotated instantaneously with zero system downtime.",
  },
  {
    icon: FileText,
    title: "Immutable Audit Trails",
    description:
      "Every administrative operation, member invitation, key creation, role change, and load-test dispatch is permanently logged in a tamper-resistant audit trail.",
  },
  {
    icon: ShieldCheck,
    title: "HMAC-Signed Webhooks",
    description:
      "Outgoing incident alerts and event deliveries are signed with HMAC-SHA256 signatures, enabling target consumers to cryptographically verify payload integrity.",
  },
  {
    icon: Server,
    title: "Isolated Load Engines",
    description:
      "High-throughput test engines run in ephemeral execution sandboxes with network throttling protection to prevent unintended cascading impact.",
  },
];

export default function SecurityPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            Enterprise Trust &amp; Compliance
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            Built for High-Assurance Engineering
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
            Security and tenant isolation are foundational design principles at STRIM Labs. Here is how we safeguard your telemetry, credentials, and infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          {SECURITY_ITEMS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm space-y-3"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <item.icon className="size-5" />
              </div>
              <h2 className="text-base font-bold text-foreground">{item.title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
