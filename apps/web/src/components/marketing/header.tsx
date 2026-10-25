"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { CircularThemeToggle } from "../circular-theme-toggle";
import { Logo } from "../logo";
import { buttonVariants } from "../ui/button";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/docs", label: "Docs" },
  { href: "https://github.com/Prince-695/Strim", label: "GitHub", external: true },
] as const;

export function MarketingHeader({ overDark = false }: { overDark?: boolean }) {
  const pathname = usePathname();
  const { ready, token } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const signedIn = ready && Boolean(token);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled || open
          ? "border-b border-border bg-background/80 backdrop-blur-xl shadow-xs"
          : "border-b border-transparent bg-background/40 backdrop-blur-xs",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="STRIM Labs home">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              {...("external" in l ? { target: "_blank", rel: "noreferrer" } : {})}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === l.href
                  ? "text-foreground font-semibold bg-surface-muted/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-muted/40",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <CircularThemeToggle />
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                Launch console
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <CircularThemeToggle />
          <button
            type="button"
            className="rounded-lg p-2 text-foreground hover:bg-surface-muted"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
          >
            <div className="space-y-1 px-5 py-4">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block rounded-lg px-3 py-3 text-[15px] font-medium text-foreground hover:bg-surface-muted"
                >
                  {l.label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-3">
                {signedIn ? (
                  <Link href="/dashboard" className={buttonVariants({ className: "col-span-2" })}>
                    Open dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className={buttonVariants({ variant: "outline" })}>
                      Sign in
                    </Link>
                    <Link href="/signup" className={buttonVariants()}>
                      Launch console
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
