import type { ReactNode } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh flex flex-col items-center bg-background p-4 sm:p-8">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between py-4 border-b border-border/60 mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
            <Activity className="size-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-foreground">
            STRIM<span className="text-brand font-mono text-xs ml-1">LABS</span>
          </span>
        </Link>
        <span className="text-xs font-medium text-muted-foreground">Setup &amp; Onboarding</span>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-xl pb-16">{children}</main>
    </div>
  );
}
