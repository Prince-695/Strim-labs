import Link from "next/link";
import { Zap, Gauge, ArrowLeft, ArrowLeftRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Left Branding Showcase (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#0B1015] text-[#E6ECE8] border-r border-[#202D3A] relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-lg bg-brand text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform">
              <Zap className="size-4" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-white">STRIM</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-[#88978E] hover:text-white transition-colors rounded-lg px-3 py-1.5 bg-[#121820] border border-[#202D3A]"
          >
            <ArrowLeft className="size-3" /> Back to Home
          </Link>
        </div>

        {/* Hero Narrative */}
        <div className="relative z-10 my-auto py-8 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-brand-subtle border border-brand/30 text-brand text-xs font-semibold">
            <Zap className="size-3.5" />
            <span>API Load & Capacity Engine</span>
          </div>

          <h1 className="font-heading text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-white">
            Know your API breaking point before production does.
          </h1>

          <p className="text-[#88978E] text-sm leading-relaxed">
            Multi-VU HTTP load generation, empirical saturation knee detection, and live regression gates for engineering teams.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#121820] border border-[#202D3A]">
              <div className="size-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
                <Gauge className="size-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">3-Zone Capacity Spectrum</div>
                <div className="text-[11px] text-[#88978E]">
                  Accurately separates Safe Band from Saturation Knee and Critical Cliff.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#121820] border border-[#202D3A]">
              <div className="size-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
                <ArrowLeftRight className="size-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Comparison Studio & Gates</div>
                <div className="text-[11px] text-[#88978E]">
                  Block pull request merges with live latency and error rate gate thresholds.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-[#88978E] flex items-center justify-between border-t border-[#202D3A] pt-6">
          <span>Real High-Throughput Multi-Worker Engine</span>
          <span>Zero External Agent Binaries</span>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
