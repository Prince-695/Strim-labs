"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, HelpCircle, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "How much runtime overhead does @strim/sdk add to my server?",
    answer:
      "Strictly less than 0.12ms per request. The SDK uses an atomic, lock-free circular ring buffer with zero dynamic heap allocations on the hot path. Metrics are aggregated in memory and flushed asynchronously via non-blocking background micro-ticks, ensuring zero impact on your production request latency.",
  },
  {
    question: "Does STRIM store sensitive request bodies, tokens, or customer data?",
    answer:
      "Never. STRIM is built with zero-payload architecture. We only record the HTTP method, normalized route path, HTTP status code, and response time in microseconds. Request bodies, query parameters with sensitive tokens, and authorization headers are completely discarded at the middleware boundary.",
  },
  {
    question: "How does STRIM protect against accidental DDoS or SSRF vulnerabilities?",
    answer:
      "All target URLs are validated through our multi-layer SSRF firewall before any worker thread opens a TCP socket. Private IP ranges (RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), localhost/loopback addresses, and cloud provider metadata IPs (169.254.169.254) are rejected immediately. In addition, every load test includes a sub-200ms emergency kill-switch.",
  },
  {
    question: "How is STRIM different from tools like k6, Locust, or Datadog?",
    answer:
      "k6 and Locust require writing and maintaining manual test scripts in JavaScript or Python, which quickly become outdated. Datadog captures metrics after traffic has already hit production, costing thousands per host. STRIM combines both: our 1-line middleware automatically maps your routes from real traffic, and our capacity engine mathematically pinpoints the saturation knee and cliff before you ship.",
  },
  {
    question: "Can I run capacity tests against localhost or private VPC staging clusters?",
    answer:
      "Yes. You can run STRIM locally using Bun (`bun dev`), or deploy the lightweight STRIM worker runner as a Docker container directly inside your private AWS/GCP VPC or Kubernetes cluster.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
      <div className="relative mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8">

        {/* Section Heading */}
        <div className="mt-5 text-center">
          <h2 className="text-3xl tracking-[-0.035em] text-foreground sm:text-5xl leading-[1.1]">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            What engineering teams want to know about runtime overhead, data security, and capacity limits.
          </p>
        </div>

        {/* ── Squircle Accordion List ── */}
        <div className="mt-12 space-y-3.5">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-all duration-200",
                  isOpen
                    ? "border-brand/40 bg-card shadow-sm ring-1 ring-brand/10"
                    : "border-border bg-card/60 hover:border-border/80 hover:bg-card"
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left sm:px-6 sm:py-5"
                >
                  <span className="text-base font-normal text-foreground sm:text-[17px]">
                    {faq.question}
                  </span>
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted transition-transform duration-200",
                      isOpen ? "rotate-45 bg-brand text-brand-foreground border-brand" : "text-muted-foreground"
                    )}
                  >
                    <Plus className="size-4" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                    >
                      <div className="border-t border-border/60 px-5 pt-3.5 pb-5 sm:px-6 text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
