"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Layers,
  Lock,
  Radio,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const FRAMEWORKS = [
  {
    id: "hono",
    name: "Hono",
    badge: "Bun / Cloudflare / Node",
    code: `import { Hono } from "hono";
import { strim } from "@strim/sdk";

const app = new Hono();

// Single middleware: discovers routes & timings
app.use("*", strim({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_9f81a7b...",
}));

app.get("/checkout", (c) => c.json({ status: "ready" }));

export default app;`,
  },
  {
    id: "express",
    name: "Express",
    badge: "Node.js v18+",
    code: `import express from "express";
import { strimExpress } from "@strim/sdk/express";

const app = express();

// Plug into top-level Express chain
app.use(strimExpress({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_9f81a7b...",
}));

app.get("/api/v1/orders", (req, res) => {
  res.json({ orders: [] });
});

app.listen(3000);`,
  },
  {
    id: "nextjs",
    name: "Next.js",
    badge: "App Router / Turbopack",
    code: `// middleware.ts
import { strimMiddleware } from "@strim/sdk/next";

export const middleware = strimMiddleware({
  apiKey: process.env.STRIM_API_KEY,
  projectId: "strim_live_9f81a7b...",
});

export const config = {
  matcher: ["/api/:path*"],
};`,
  },
];

export function FeatureDeepDive() {
  const [selectedFramework, setSelectedFramework] = useState(0);
  const [copied, setCopied] = useState(false);
  const [firewallTarget, setFirewallTarget] = useState("169.254.169.254");
  const [firewallBlocked, setFirewallBlocked] = useState(true);

  function handleCopy() {
    navigator.clipboard.writeText(FRAMEWORKS[selectedFramework].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleTestIp(ip: string) {
    setFirewallTarget(ip);
    if (
      ip.startsWith("127.") ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("172.16.") ||
      ip.includes("169.254") ||
      ip.includes("localhost")
    ) {
      setFirewallBlocked(true);
    } else {
      setFirewallBlocked(false);
    }
  }

  return (
    <section id="sdk" className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Large Rounded Inset Card Container */}
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-2xl sm:p-12 lg:p-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-start">
            {/* ── Left Column: Story & Polyglot SDK ── */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-subtle px-3.5 py-1 text-xs font-semibold text-brand-foreground dark:text-brand">
                <Zap className="size-3.5 text-brand" />
                <span>Zero-Script Instrumentation</span>
              </div>

              <h3 className="mt-5 text-3xl font-bold tracking-[-0.035em] text-foreground sm:text-4xl lg:text-[46px] leading-[1.1]">
                Measure where your code runs.
              </h3>

              <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
                <p>
                  Zero synthetic test scripts to write or keep in sync with codebases. Add <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-foreground">@strim/sdk</code> to your Hono, Express, Fastify, or Next.js server.
                </p>
                <p>
                  Every request is captured by an atomic, lock-free 500ms circular ring buffer with less than 0.12ms execution overhead. Endpoints and methods are automatically registered without schema uploads.
                </p>
              </div>

              {/* Code Snippet Box with Tabs */}
              <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface-muted/40 shadow-inner">
                <div className="flex items-center justify-between border-b border-border bg-surface-muted/60 px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {FRAMEWORKS.map((fw, idx) => (
                      <button
                        key={fw.id}
                        type="button"
                        onClick={() => setSelectedFramework(idx)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          selectedFramework === idx
                            ? "bg-foreground text-background font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {fw.name}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3 text-brand" />
                        <span className="text-brand">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 overflow-x-auto">
                  <pre className="font-mono text-xs text-foreground/90 leading-relaxed">
                    <code>{FRAMEWORKS[selectedFramework].code}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* ── Right Column: Stack of 3 Numbered Interactive Cards ── */}
            <div className="space-y-4">
              {/* Card 1: Auto-Discovery */}
              <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 sm:p-6 transition-all hover:border-brand/40">
                <div className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground font-mono text-xs font-bold text-background">
                    1
                  </span>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-foreground">Zero-Script Auto-Discovery</h4>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      As traffic reaches your backend, STRIM registers routes, HTTP methods, and parameter shapes dynamically. No manual schema uploads or YAML specs needed.
                    </p>

                    {/* Miniature Visual */}
                    <div className="mt-3.5 rounded-xl border border-border bg-card p-3 font-mono text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-brand">POST /api/checkout</span>
                        <span>status: 200</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-foreground">GET /api/users/:id</span>
                        <span>status: 200</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Lock-Free Ring Buffer */}
              <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 sm:p-6 transition-all hover:border-brand/40">
                <div className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground font-mono text-xs font-bold text-background">
                    2
                  </span>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-foreground">Lock-Free 500ms Ring Buffer</h4>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      High-frequency atomic circular buffer flushes asynchronously. Zero memory leaks, zero mutex contention, and strictly &lt; 0.12ms latency overhead.
                    </p>

                    {/* Miniature Visual */}
                    <div className="mt-3.5 flex items-center gap-1.5 rounded-xl border border-border bg-card p-3 font-mono text-[11px]">
                      <Radio className="size-3.5 text-brand animate-pulse shrink-0" />
                      <span className="text-muted-foreground">Flushing 16 buffer slots every 500ms</span>
                      <span className="ml-auto text-brand font-semibold">&lt; 0.12ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: SSRF & Safety Firewall */}
              <div className="rounded-2xl border border-border bg-surface-muted/30 p-5 sm:p-6 transition-all hover:border-brand/40">
                <div className="flex items-start gap-4">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground font-mono text-xs font-bold text-background">
                    3
                  </span>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-foreground">SSRF &amp; Loopback Protection</h4>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      Target endpoints are verified against private IP ranges and internal cloud metadata scopes before any socket opens.
                    </p>

                    {/* Interactive Validator */}
                    <div className="mt-3.5 rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={firewallTarget}
                          onChange={(e) => handleTestIp(e.target.value)}
                          className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none"
                          placeholder="e.g. 169.254.169.254 or api.example.com"
                        />
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase shrink-0",
                            firewallBlocked
                              ? "bg-danger-subtle text-destructive border border-destructive/30"
                              : "bg-brand-subtle text-brand border border-brand/30"
                          )}
                        >
                          {firewallBlocked ? "Blocked" : "Allowed"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {firewallBlocked
                          ? "SSRF firewall blocked private VPC / AWS metadata target."
                          : "Public IP verified. Socket creation permitted."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
