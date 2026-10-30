"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/session-provider";
import { cn } from "@/lib/utils";
import { CircularThemeToggle } from "../circular-theme-toggle";
import { Logo } from "../logo";
import { buttonVariants } from "../ui/button";

const NAV_LINKS = [
  { href: "/#funnel", label: "Why STRIM" },
  { href: "/features", label: "Features" },
  { href: "/#discovery", label: "Discovery" },
  { href: "/#saturation", label: "Capacity Engine" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
] as const;

export function FloatingNav() {
  const { isReady, isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const signedIn = isReady && isAuthenticated;

  return (
    <>
      <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:px-6 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto flex items-center justify-between gap-3 sm:gap-6 rounded-full border px-4 py-2 sm:px-5 sm:py-2 transition-all duration-300",
            scrolled
              ? "border-border/90 bg-background/90 shadow-xl shadow-black/8 backdrop-blur-2xl ring-1 ring-border/50"
              : "border-border/60 bg-background/75 shadow-lg shadow-black/5 backdrop-blur-xl"
          )}
        >
          {/* Logo & Status Badge */}
          <Link href="/" className="flex items-center gap-2.5 pr-1" aria-label="STRIM Labs Home">
            <Logo />
            <span className="hidden items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-2 py-0.5 text-[10px] font-semibold text-brand-foreground dark:text-brand sm:inline-flex">
              <span className="size-1.5 rounded-full bg-brand animate-pulse" />
              v0.9 ready
            </span>
          </Link>

          {/* Center Links (Desktop) */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main Navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <CircularThemeToggle />
            {signedIn ? (
              <Link
                href="/app"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "rounded-full px-4 text-xs font-semibold shadow-sm hover:shadow-brand/20 transition-all"
                )}
              >
                Console
              </Link>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "hidden sm:inline-flex rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "group rounded-full bg-brand text-brand-foreground hover:bg-brand-strong px-4 text-xs font-semibold shadow-md shadow-brand/20 hover:shadow-brand/30 transition-all"
                  )}
                >
                  <span>Launch console</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="flex size-8 items-center justify-center rounded-full text-foreground hover:bg-surface-muted md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-4 top-20 z-50 rounded-2xl border border-border bg-background/95 p-5 shadow-2xl backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
                {signedIn ? (
                  <Link
                    href="/app"
                    onClick={() => setMobileOpen(false)}
                    className={cn(buttonVariants({ size: "sm" }), "col-span-2 rounded-xl bg-brand text-brand-foreground")}
                  >
                    Console
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/sign-in"
                      onClick={() => setMobileOpen(false)}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")}
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setMobileOpen(false)}
                      className={cn(buttonVariants({ size: "sm" }), "rounded-xl bg-brand text-brand-foreground")}
                    >
                      Launch console
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
