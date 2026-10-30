import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center p-4 bg-background">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      {/* Top Header Logo */}
      <div className="relative z-10 mb-8 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm transition-transform group-hover:scale-105">
            <Activity className="size-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            STRIM<span className="text-brand font-mono text-sm ml-1">LABS</span>
          </span>
        </Link>
      </div>

      {/* Main Form Container */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card/90 p-6 sm:p-8 shadow-xl backdrop-blur-md">
        {children}
      </div>

      {/* Footer Info */}
      <div className="relative z-10 mt-8 text-center text-xs text-muted-foreground">
        <span>STRIM Labs &copy; {new Date().getFullYear()} &middot; High-Throughput API Observability</span>
      </div>
    </div>
  );
}
