import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — STRIM Labs",
  description: "Privacy policy regarding telemetry data handling, account information, and data retention.",
};

export default function PrivacyPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Effective Date: October 26, 2026 &middot; Version 2.0
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-muted-foreground text-xs leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
            <p>
              STRIM Labs (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides API observability, automated API discovery, and distributed load testing infrastructure. This Privacy Policy describes how we collect, store, and process data when you use our SaaS console, SDKs, and platform APIs.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Telemetry and Application Data</h2>
            <p>
              When instrumenting backend services with the STRIM SDK or OTel exporter, our gateways collect operational telemetry including HTTP methods, normalized route paths, status codes, response durations, and error rates. STRIM Labs does not inspect, parse, or persist sensitive request or response bodies unless explicitly configured by the tenant for debugging purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Account and Organization Data</h2>
            <p>
              We collect user registration details including name, work email address, hashed passwords, session IP addresses, and organization profile information to deliver multi-tenant service isolation and authentication.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Data Retention and Deletion</h2>
            <p>
              Telemetry metrics, traces, and test execution samples are retained according to your organization&apos;s subscription quota (typically 30 to 90 days). Upon organization deletion or account termination, all tenant-associated data is permanently purged in compliance with applicable data protection regulations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Contact</h2>
            <p>
              For privacy inquiries or data subject access requests, please contact{" "}
              <a href="mailto:privacy@strim-labs.com" className="text-brand hover:underline">
                privacy@strim-labs.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
