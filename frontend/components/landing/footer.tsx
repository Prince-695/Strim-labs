"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowUp } from "lucide-react"

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export function Footer() {
  const currentYear = new Date().getFullYear()

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <footer className="border-t border-border bg-background py-14 font-mono text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand Info */}
          <div className="space-y-4 lg:col-span-2">
            <Link href="/" className="group flex items-center gap-2.5">
              <div>
                <Image
                  src="/logo.png"
                  alt="Strim Labs Logo"
                  width={32}
                  height={32}
                  className="size-full object-contain"
                />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-brand">
                Strim Labs
              </span>
            </Link>
            <p className="max-w-sm font-sans text-xs leading-relaxed text-foreground-muted">
              API load testing, automatic discovery, and real-time performance
              monitoring. Find your server&apos;s breaking point before
              production does.
            </p>
          </div>

          {/* Platform Navigation */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Platform
            </p>
            <ul className="space-y-2 font-sans text-xs text-foreground-muted">
              <li>
                <Link
                  href="#workbench"
                  className="transition-colors hover:text-foreground"
                >
                  Explore Cockpit
                </Link>
              </li>
              <li>
                <Link
                  href="#benchmarks"
                  className="transition-colors hover:text-foreground"
                >
                  Benchmarks
                </Link>
              </li>
              <li>
                <Link
                  href="#architecture"
                  className="transition-colors hover:text-foreground"
                >
                  Architecture
                </Link>
              </li>
              <li>
                <Link
                  href="#methodology"
                  className="transition-colors hover:text-foreground"
                >
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Developer Tools */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Developers
            </p>
            <ul className="space-y-2 font-sans text-xs text-foreground-muted">
              <li>
                <Link
                  href="#simulator"
                  className="transition-colors hover:text-foreground"
                >
                  Protocol Simulator
                </Link>
              </li>
              <li>
                <Link
                  href="#quickstart"
                  className="transition-colors hover:text-foreground"
                >
                  Quickstart CLI
                </Link>
              </li>
              <li>
                <Link
                  href="#faq"
                  className="transition-colors hover:text-foreground"
                >
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/Prince-695"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <GithubIcon className="size-3 text-sand" />
                  <span>GitHub</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Account & Access */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
              Access
            </p>
            <ul className="space-y-2 font-sans text-xs text-foreground-muted">
              <li>
                <Link
                  href="/login"
                  className="transition-colors hover:text-foreground"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="font-medium text-brand transition-colors hover:text-foreground"
                >
                  Create Free Account →
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="transition-colors hover:text-foreground"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Smooth Back to Top */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-[11px] text-foreground-subtle sm:flex-row">
          <p>© {currentYear} STRIM Labs. Open Source under Apache 2.0.</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={scrollToTop}
              className="flex cursor-pointer items-center gap-1 transition-colors hover:text-sand"
            >
              <span>Back to top</span>
              <ArrowUp className="size-3" />
            </button>
            <a
              href="https://github.com/Prince-695"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-sand"
            >
              GitHub
            </a>
            <span className="text-brand">v1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
