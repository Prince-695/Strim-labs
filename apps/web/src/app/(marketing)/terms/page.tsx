import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — STRIM Labs",
  description: "Terms and conditions governing the use of the STRIM Labs platform and load testing services.",
};

export default function TermsPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Effective Date: October 26, 2026 &middot; Version 2.0
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-muted-foreground text-xs leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using STRIM Labs (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you are entering into this agreement on behalf of a company or legal entity, you represent that you have the authority to bind such entity.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Authorized Target Testing &amp; Acceptable Use</h2>
            <p>
              STRIM Labs provides distributed HTTP load generation and breaking point detection capabilities. You explicitly agree to only direct load tests against endpoints, servers, and infrastructure that you own or have obtained documented authorization to evaluate. Unsolicited Denial of Service (DoS) attacks or targeting unauthorized third-party systems constitutes a material violation and will result in immediate account termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Account &amp; Tenant Limits</h2>
            <p>
              To maintain fair resource allocation across tenants, users are limited to a maximum of 3 organization memberships, and each organization is limited to 5 projects unless upgraded under an Enterprise plan.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Limitation of Liability</h2>
            <p>
              In no event shall STRIM Labs be liable for any indirect, incidental, special, consequential, or punitive damages arising out of the performance testing or saturation degradation of your target services.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
