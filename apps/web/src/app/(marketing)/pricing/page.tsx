import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight, Zap, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing — Transparent Quotas for API Engineering",
  description:
    "Predictable developer pricing for multi-tenant API monitoring, breaking point detection, and distributed load testing.",
};

const TIERS = [
  {
    name: "Developer",
    price: "$0",
    frequency: "forever free",
    description: "Everything individual engineers need to explore breaking points and test APIs.",
    features: [
      "1,000,000 monthly telemetry events",
      "Up to 3 organizations per user",
      "Up to 5 projects per organization",
      "120 load-test minutes / month",
      "Concurrency up to 100 Virtual Users",
      "30-day telemetry retention",
      "Automated breaking point analysis",
      "Community GitHub support",
    ],
    cta: "Start Free",
    ctaHref: "/sign-up",
    popular: false,
  },
  {
    name: "Team",
    price: "$49",
    frequency: "per month",
    description: "Designed for fast-moving engineering teams shipping continuous microservices.",
    features: [
      "5,000,000 monthly telemetry events",
      "Unlimited team member seats",
      "Up to 5 projects per organization",
      "300 load-test minutes / month",
      "Concurrency up to 500 Virtual Users",
      "60-day telemetry retention",
      "CI/CD PR regression gating",
      "Slack & PagerDuty incident alerts",
      "Priority email & Discord support",
    ],
    cta: "Start 14-Day Free Trial",
    ctaHref: "/sign-up",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    frequency: "billed annually",
    description: "For high-scale enterprises requiring custom concurrency and dedicated support.",
    features: [
      "50M+ monthly telemetry events",
      "Custom project & organization quotas",
      "Dedicated load generation clusters",
      "Concurrency up to 5,000+ Virtual Users",
      "1-year telemetry retention & export",
      "99.99% uptime SLA guarantee",
      "Custom SSO / SAML & SCIM provisioning",
      "Dedicated solutions architect",
    ],
    cta: "Contact Enterprise Sales",
    ctaHref: "/contact",
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            Simple, Transparent Quotas
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            Predictable Pricing for API Engineering
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base leading-relaxed">
            Start free without a credit card. Upgrade whenever your team requires higher throughput concurrency or longer retention.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3 sm:mt-20">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col justify-between rounded-2xl border p-8 shadow-sm transition-all ${
                tier.popular
                  ? "border-brand bg-card shadow-brand/5 shadow-2xl ring-1 ring-brand"
                  : "border-border bg-card/60 hover:border-brand/40"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-xs font-bold text-brand-foreground shadow-sm flex items-center gap-1">
                  <Sparkles className="size-3" /> Most Popular
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {tier.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-4xl font-extrabold font-mono text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-xs text-muted-foreground">/ {tier.frequency}</span>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Included capabilities:
                  </span>
                  <ul className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="size-4 text-brand shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  asChild
                  className={`w-full ${
                    tier.popular
                      ? "bg-brand text-brand-foreground hover:bg-brand-strong"
                      : "bg-surface-muted hover:bg-surface-muted/80 text-foreground"
                  }`}
                >
                  <Link href={tier.ctaHref}>
                    {tier.cta}
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Quota Guarantee */}
        <div className="mt-16 rounded-xl border border-border bg-surface-muted/30 p-6 sm:p-8 text-center max-w-3xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Shield className="size-4 text-emerald-500" />
            Backend-Enforced Multi-Tenant Quotas
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All accounts adhere to backend-enforced tenancy limits: a maximum of 3 organization memberships per user and 5 projects per organization. Need higher project caps? Contact enterprise support.
          </p>
        </div>
      </div>
    </div>
  );
}
