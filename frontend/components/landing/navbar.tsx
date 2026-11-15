"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, X, ArrowRight, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LandingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface shadow-xs">
            <span className="font-mono text-sm font-bold tracking-tighter text-brand">S</span>
            <span className="font-mono text-sm font-bold tracking-tighter text-sand">L</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-sm font-bold tracking-tight text-foreground">
              STRIM
            </span>
            <span className="text-[10px] font-mono tracking-widest text-sand uppercase">
              LABS
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="#capabilities"
            className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Capabilities
          </Link>
          <Link
            href="#workflow"
            className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="#architecture"
            className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Architecture
          </Link>
          <Link
            href="#security"
            className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Security & Verification
          </Link>
          <a
            href="https://strim-labs.onrender.com/swagger/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            <BookOpen className="size-3.5" />
            <span>API Docs</span>
          </a>
        </nav>

        {/* Right Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/login" />}
            className="text-xs font-medium text-foreground-muted hover:text-foreground"
          >
            Sign In
          </Button>
          <Button
            size="sm"
            render={<Link href="/signup" />}
            className="gap-1.5 bg-brand text-white hover:bg-brand-hover shadow-xs font-medium text-xs"
          >
            <span>Get Started</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-foreground-muted"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border bg-surface px-4 py-4 md:hidden space-y-3">
          <nav className="flex flex-col space-y-2.5">
            <Link
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              Capabilities
            </Link>
            <Link
              href="#workflow"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              How It Works
            </Link>
            <Link
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              Architecture
            </Link>
            <Link
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              Security & Verification
            </Link>
            <a
              href="https://strim-labs.onrender.com/swagger/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              <BookOpen className="size-4" />
              <span>Swagger API Docs</span>
            </a>
          </nav>
          <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
            <Button
              size="sm"
              render={<Link href="/dashboard" />}
              className="w-full justify-center bg-brand text-white hover:bg-brand-hover text-xs"
            >
              <span>Launch App</span>
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
