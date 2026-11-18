import * as React from "react"
import Link from "next/link"
import { Play, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTASection() {
  return (
    <section className="py-20 border-t border-border bg-surface-raised/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-6 py-16 text-center sm:px-12 sm:py-20 shadow-xl">
          <div className="mx-auto max-w-2xl space-y-6">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl font-heading">
              Ready to find your API&apos;s breaking point?
            </h2>
            <p className="text-sm sm:text-base text-foreground-muted leading-relaxed">
              Launch real load tests, inspect live execution with zero polling, and analyze capacity
              knees with production-grade tooling.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button
                size="lg"
                render={<Link href="/dashboard" />}
                className="gap-2 bg-brand text-white hover:bg-brand-hover shadow-lg font-medium px-6 text-sm"
              >
                <Play className="size-4 fill-current" />
                <span>Launch STRIM Dashboard</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                render={
                  <a
                    href="https://strim-labs.onrender.com/swagger/index.html"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                className="gap-2 border-border bg-surface-raised text-foreground hover:bg-surface-hover px-6 text-sm"
              >
                <BookOpen className="size-4 text-sand" />
                <span>Interactive Swagger UI</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
