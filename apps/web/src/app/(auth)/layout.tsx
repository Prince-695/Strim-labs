import Link from "next/link";
import { Activity, ShieldCheck, Zap, ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Left Branding Showcase (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#0E0D1E] text-white border-r border-[#232242] relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-brand-pink/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-96 rounded-full bg-brand-lime/10 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="size-9 rounded-full bg-brand-pink flex items-center justify-center font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
              S
            </div>
            <span className="font-heading text-xl font-bold tracking-tight">STRIM</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#8E8D9F] hover:text-white transition-colors rounded-full px-3 py-1.5 bg-[#1E1D38]/60 border border-[#232242]"
          >
            <ArrowLeft className="size-3" /> Back to Home
          </Link>
        </div>

        {/* Hero Narrative */}
        <div className="relative z-10 my-auto py-8 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-brand-pink/15 border border-brand-pink/30 text-brand-pink text-xs font-semibold">
            <Activity className="size-3.5" />
            <span>Runtime Intelligence & Change Platform</span>
          </div>

          <h1 className="font-heading text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Know what a change will do before production finds out.
          </h1>

          <p className="text-[#8E8D9F] text-base leading-relaxed">
            Eliminate deployment blind spots. Simulate traffic, verify blast radius, and execute staged canary rollouts with automated circuit breakers and 1-click rollback.
          </p>

          {/* Interactive Feature Highlights */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#16152C]/80 border border-[#232242]">
              <div className="size-8 rounded-full bg-brand-lime/20 text-brand-lime flex items-center justify-center shrink-0">
                <Zap className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">What-If Simulations</div>
                <div className="text-xs text-[#8E8D9F]">Simulate 2x traffic, cache invalidations, and latency deltas prior to merge.</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#16152C]/80 border border-[#232242]">
              <div className="size-8 rounded-full bg-brand-pink/20 text-brand-pink flex items-center justify-center shrink-0">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Staged Canary Rollouts & Automated Guardrails</div>
                <div className="text-xs text-[#8E8D9F]">10% → 25% → 50% → 100% rollout with instant circuit breaker rollbacks.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Social Proof */}
        <div className="relative z-10 text-xs text-[#8E8D9F] flex items-center justify-between border-t border-[#232242] pt-6">
          <span>Fail-Open Guarantee • SOC 2 Ready</span>
          <span>Port 8080 Unified Engine</span>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
