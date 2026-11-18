"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowUp } from "lucide-react"

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
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
    <footer className="border-t border-border bg-background py-14 text-xs font-mono">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand Info */}
          <div className="space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div>
                <Image
                  src="/logo.png"
                  alt="Strim Labs Logo"
                  width={32}
                  height={32}
                  className="size-full object-contain"
                />
              </div>
              <span className="font-bold tracking-tight text-foreground text-sm group-hover:text-brand transition-colors">
                Strim Labs
              </span>
            </Link>
            <p className="text-xs text-foreground-muted leading-relaxed font-sans max-w-sm">
              API load testing, automatic discovery, and real-time performance monitoring. Find your server&apos;s breaking point before production does.
            </p>
          </div>

          {/* Platform Navigation */}
          <div className="space-y-3">
            <p className="font-semibold text-foreground tracking-wider uppercase text-[11px]">
              Platform
            </p>
            <ul className="space-y-2 text-foreground-muted font-sans text-xs">
              <li>
                <Link href="#workbench" className="hover:text-foreground transition-colors">
                  Explore Cockpit
                </Link>
              </li>
              <li>
                <Link href="#benchmarks" className="hover:text-foreground transition-colors">
                  Benchmarks
                </Link>
              </li>
              <li>
                <Link href="#architecture" className="hover:text-foreground transition-colors">
                  Architecture
                </Link>
              </li>
              <li>
                <Link href="#methodology" className="hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Developer Tools */}
          <div className="space-y-3">
            <p className="font-semibold text-foreground tracking-wider uppercase text-[11px]">
              Developers
            </p>
            <ul className="space-y-2 text-foreground-muted font-sans text-xs">
              <li>
                <Link href="#simulator" className="hover:text-foreground transition-colors">
                  Protocol Simulator
                </Link>
              </li>
              <li>
                <Link href="#quickstart" className="hover:text-foreground transition-colors">
                  Quickstart CLI
                </Link>
              </li>
              <li>
                <Link href="#faq" className="hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/Prince-695"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                >
                  <GithubIcon className="size-3 text-sand" />
                  <span>GitHub</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Account & Access */}
          <div className="space-y-3">
            <p className="font-semibold text-foreground tracking-wider uppercase text-[11px]">
              Access
            </p>
            <ul className="space-y-2 text-foreground-muted font-sans text-xs">
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-foreground transition-colors text-brand font-medium">
                  Create Free Account →
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Smooth Back to Top */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-foreground-subtle text-[11px]">
          <p>© {currentYear} STRIM Labs. Open Source under Apache 2.0.</p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={scrollToTop}
              className="hover:text-sand flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Back to top</span>
              <ArrowUp className="size-3" />
            </button>
            <a
              href="https://github.com/Prince-695"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sand transition-colors"
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
