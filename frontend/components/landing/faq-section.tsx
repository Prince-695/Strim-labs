"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

interface FAQItem {
  id: string
  index: string
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    id: "diff-tools",
    index: "01",
    question: "How is STRIM different from other load testing tools?",
    answer:
      "Traditional tools only give you average response times, hiding problems until production. STRIM maps your endpoints automatically, streams live response times as traffic ramps up, spots your server's breaking point, and tells you what caused it.",
  },
  {
    id: "knee-math",
    index: "02",
    question: "How does breaking point detection work?",
    answer:
      "STRIM gradually ramps up user traffic and continuously tracks response times. The moment latency spikes or requests queue up, STRIM marks your safe traffic limit and stops the test before crashing your server.",
  },
  {
    id: "production-safety",
    index: "03",
    question: "Is it safe to run against staging or live servers?",
    answer:
      "Yes. STRIM includes built-in safety circuit breakers. If response times cross your SLA threshold or error rates rise above 1%, the test stops immediately to protect your databases and backend services.",
  },
  {
    id: "target-verification",
    index: "04",
    question: "How do you verify server ownership?",
    answer:
      "Before testing, you verify ownership with a simple DNS record or a text file placed on your server. This guarantees that only authorized owners can test their own systems.",
  },
  {
    id: "self-hosting-vpc",
    index: "05",
    question: "Can I run STRIM on my own servers?",
    answer:
      "Yes. STRIM is open source (Apache 2.0). You can run it with Docker or as a single binary inside your own cloud or private network without exposing any data to the public internet.",
  },
]

export function FAQSection() {
  const [openId, setOpenId] = React.useState<string | null>("diff-tools")

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <section id="faq" className="scroll-mt-20 border-t border-border bg-background px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3.5 py-1 font-mono text-xs text-foreground-muted mb-4">
            <span className="text-brand">[06]</span>
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="font-mono text-2xl sm:text-3xl font-light text-foreground tracking-[-0.03em]">
            Everything you need to know.
          </h2>
          <p className="mt-3 font-sans text-sm text-foreground-muted">
            Simple answers to common questions about testing, monitoring, and scaling with STRIM Labs.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {FAQS.map((faq) => {
            const isOpen = openId === faq.id
            return (
              <div
                key={faq.id}
                className="rounded-xl border border-border bg-surface overflow-hidden transition-colors hover:border-border"
              >
                <button
                  type="button"
                  onClick={() => toggle(faq.id)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-brand font-semibold">{faq.index}</span>
                    <span className="font-mono text-sm font-normal text-foreground">
                      {faq.question}
                    </span>
                  </div>
                  <ChevronDown
                    className={`size-4 text-foreground-subtle shrink-0 ml-4 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-brand" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-border">
                    <p className="font-sans text-xs text-sand leading-relaxed pt-3">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
