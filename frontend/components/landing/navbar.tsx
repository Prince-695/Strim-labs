"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X, ArrowRight, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/lib/stores/auth-store"

const emptySubscribe = () => () => {}

function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

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

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const { isAuthenticated, initialize } = useAuthStore()
  const mounted = useMounted()

  React.useEffect(() => {
    initialize()
  }, [initialize])

  const isLoggedIn = mounted && isAuthenticated

  return (
    <header className="sticky top-0 z-50 mx-auto w-full border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="group flex items-center">
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
            <span className="text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-brand">
              Strim Labs
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-6 font-mono text-xs md:flex lg:gap-7">
          <Link
            href="#workbench"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            Explore
          </Link>
          <Link
            href="#benchmarks"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            Benchmarks
          </Link>
          <Link
            href="#architecture"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            Architecture
          </Link>
          <Link
            href="#methodology"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            href="#simulator"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            Simulator
          </Link>
          <Link
            href="#quickstart"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            Quickstart
          </Link>
          <Link
            href="#faq"
            className="text-foreground-muted transition-colors hover:text-foreground"
          >
            FAQ
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <Button
              variant="outline"
              size="icon-sm"
              render={<Link href="/dashboard" />}
              className="border-border-subtle bg-surface-raised text-foreground transition-all hover:border-brand/50 hover:bg-surface-raised/80 hover:text-brand"
              aria-label="Dashboard"
              title="Dashboard"
            >
              <LayoutDashboard className="size-4" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/login" />}
                className="font-mono text-xs tracking-wider text-foreground-muted uppercase hover:bg-surface-raised hover:text-foreground"
              >
                Sign In
              </Button>

              <Button
                size="sm"
                render={<Link href="/signup" />}
                className="gap-1.5 bg-brand px-3.5 font-mono text-xs font-bold tracking-wider text-white uppercase shadow-xs hover:bg-brand-hover"
              >
                <span>Start Test</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </>
          )}
        </div>

        {/* Mobile Actions & Hamburger Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          {isLoggedIn && (
            <Button
              variant="outline"
              size="icon-sm"
              render={<Link href="/dashboard" />}
              className="border-border-subtle bg-surface-raised text-foreground transition-all hover:border-brand/50 hover:bg-surface-raised/80 hover:text-brand"
              aria-label="Dashboard"
              title="Dashboard"
            >
              <LayoutDashboard className="size-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-foreground-muted hover:text-foreground"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="space-y-4 border-b border-border-subtle bg-background px-4 py-6 font-mono text-xs md:hidden">
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

          <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">
            {isLoggedIn ? (
              <Button
                size="sm"
                render={<Link href="/dashboard" />}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full justify-center gap-2 bg-brand font-mono text-xs font-bold text-white uppercase hover:bg-brand-hover"
              >
                <LayoutDashboard className="size-4" />
                <span>Dashboard</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/login" />}
                  className="w-full justify-center border-border-subtle font-mono text-xs text-sand uppercase"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  render={<Link href="/signup" />}
                  className="w-full justify-center bg-brand font-mono text-xs font-bold text-white uppercase hover:bg-brand-hover"
                >
                  Start Load Test
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
