"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X, ArrowRight, BookOpen, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-50 border-b w-full mx-auto backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center group">
          <div className="">
            <Image
              src="/logo.png"
              alt="Strim Labs Logo"
              width={33}
              height={33}
              priority
              className="size-full object-contain"
            />
          </div>
          <div className="flex items-baseline font-mono">
            <span className="text-sm font-semibold tracking-tight text-foreground group-hover:text-brand transition-colors">Strim Labs</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-6 lg:gap-7 md:flex font-mono text-xs">
          <Link
            href="#workbench"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Explore
          </Link>
          <Link
            href="#benchmarks"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Benchmarks
          </Link>
          <Link
            href="#architecture"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Architecture
          </Link>
          <Link
            href="#methodology"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            How it works
          </Link>
          <Link
            href="#simulator"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Simulator
          </Link>
          <Link
            href="#quickstart"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            Quickstart
          </Link>
          <Link
            href="#faq"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            FAQ
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/login" />}
            className="font-mono text-xs uppercase tracking-wider text-foreground-muted hover:text-foreground hover:bg-surface-raised"
          >
            Sign In
          </Button>

          <Button
            size="sm"
            render={<Link href="/signup" />}
            className="gap-1.5 bg-brand hover:bg-brand-hover text-white font-mono text-xs uppercase tracking-wider font-bold shadow-xs px-3.5"
          >
            <span>Start Test</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-foreground-muted hover:text-foreground"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border-subtle bg-background px-4 py-6 md:hidden font-mono text-xs space-y-4">
          <div className="flex flex-col space-y-3">
            <Link
              href="#workbench"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground-muted hover:text-foreground"
            >
              [01] EXPLORE COCKPIT
            </Link>
            <Link
              href="#benchmarks"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground-muted hover:text-foreground"
            >
              [02] ACCURATE BENCHMARKS
            </Link>
            <Link
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground-muted hover:text-foreground"
            >
              [03] HOW IT WORKS
            </Link>
            <Link
              href="#methodology"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground-muted hover:text-foreground"
            >
              [04] 4-STEP METHODOLOGY
            </Link>
            <Link
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground-muted hover:text-foreground"
            >
              [05] PROTOCOL SIMULATOR
            </Link>
            <Link
              href="#quickstart"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground-muted hover:text-foreground"
            >
              [06] QUICKSTART CLI
            </Link>
            <Link
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground-muted hover:text-foreground"
            >
              [07] FREQUENTLY ASKED
            </Link>
          </div>

          <div className="pt-4 border-t border-border-subtle flex flex-col gap-2.5">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/login" />}
              className="w-full justify-center border-border-subtle text-sand font-mono text-xs uppercase"
            >
              Sign In
            </Button>
            <Button
              size="sm"
              render={<Link href="/signup" />}
              className="w-full justify-center bg-brand hover:bg-brand-hover text-white font-mono text-xs uppercase font-bold"
            >
              Start Load Test
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
