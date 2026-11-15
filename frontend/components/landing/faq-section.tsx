import * as React from "react"

const faqs = [
  {
    q: "What is the difference between Open and Closed load models?",
    a: "Closed models maintain a fixed count of concurrent virtual users (VUs) who wait for a response before making the next request. Open models decouple arrival rates from system response times, sending a target RPS regardless of whether previous requests have completed—essential for exposing coordinated omission and true capacity breaking points.",
  },
  {
    q: "How does STRIM identify the breaking point or saturation knee?",
    a: "STRIM's capacity analyzer inspects latency percentiles (P95/P99) and error rates across stepped load windows. When queuing delays compound exponentially or error rates breach configured thresholds, the engine marks the knee and reports the maximum sustainable RPS with confidence scoring.",
  },
  {
    q: "Why is DNS TXT verification mandatory for targets?",
    a: "Because STRIM sends high-volume HTTP traffic capable of stressing infrastructure, you must verify that your organization owns or controls the target host domain by placing a unique verification token in a DNS TXT record.",
  },
  {
    q: "Can I trigger load tests automatically from CI/CD pipelines?",
    a: "Yes. STRIM provides scoped developer API keys and idempotent REST endpoints (`POST /load-tests`) enabling automated regression tests in GitHub Actions, GitLab CI, or custom deployment pipelines.",
  },
]

export function FAQSection() {
  return (
    <section className="py-20 lg:py-28 border-t border-border bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground font-heading">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-sm text-foreground-muted">
            Technical answers to common performance testing questions.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-6 space-y-2.5"
            >
              <h3 className="text-sm font-semibold text-foreground font-heading">
                {faq.q}
              </h3>
              <p className="text-xs sm:text-sm text-foreground-muted leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
