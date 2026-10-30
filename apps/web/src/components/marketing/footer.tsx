"use client";

import Link from "next/link";
import { Logo } from "../logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40 py-10">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
        {/* Left: Logo & Copyright */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-center sm:text-left">
          <Link href="/" aria-label="STRIM Labs Home">
            <Logo />
          </Link>
          <span className="hidden sm:inline text-muted-foreground/40">•</span>
          <span className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} STRIM Labs Inc. Observability &amp; Capacity Engineering. All rights reserved.
          </span>
        </div>

        {/* Right: Navigation Links */}
        <div className="flex items-center gap-5 text-xs font-medium text-muted-foreground">
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Docs
          </Link>
          <a
            href="https://github.com/Prince-695/Strim"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}

export const MarketingFooter = Footer;
