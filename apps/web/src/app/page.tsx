"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useGsap } from "@/hooks/use-gsap";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
  BarChart3,
  Globe,
  Lock,
  Clock,
  TrendingUp,
  Users,
} from "lucide-react";

/* ─── Mini animated dashboard mock ──────────────────────────────────── */
function DashboardMock() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const bars = ref.current.querySelectorAll(".mock-bar");
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    bars.forEach((bar, i) => {
      tl.to(bar, {
        scaleY: 0.3 + Math.random() * 0.7,
        duration: 0.8 + i * 0.1,
        ease: "sine.inOut",
      }, i * 0.15);
    });
    return () => { tl.kill(); };
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Mock browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground font-mono">app.strim.dev/dashboard</span>
          </div>
        </div>

        {/* Mock dashboard content */}
        <div className="p-5 space-y-4">
          {/* Mock KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Health", value: "98", color: "bg-emerald-500" },
              { label: "Requests", value: "345/s", color: "bg-sky-500" },
              { label: "Speed", value: "178ms", color: "bg-emerald-500" },
              { label: "Errors", value: "0.02%", color: "bg-emerald-500" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-secondary/50 border border-border/60 p-3">
                <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">{kpi.label}</p>
                <p className="text-lg font-heading font-black text-foreground mt-1">{kpi.value}</p>
                <div className="w-full bg-secondary h-1 rounded-full mt-2 overflow-hidden">
                  <div className={cn("h-full rounded-full", kpi.color)} style={{ width: "85%" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Mock chart area with animated bars */}
          <div className="rounded-xl bg-secondary/30 border border-border/60 p-4 h-32 flex items-end gap-1.5 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="mock-bar flex-1 rounded-t-sm bg-brand-pink/60 origin-bottom"
                style={{ height: `${30 + Math.random() * 70}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-white animate-pulse" />
        Live
      </div>
    </div>
  );
}

/* ─── Bento feature card ────────────────────────────────────────────── */
function BentoCard({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "group relative rounded-2xl border border-border bg-card p-6 hover:border-brand-pink/40 transition-all duration-300 hover:shadow-lg overflow-hidden",
      className
    )}>
      <div className="relative z-10">
        <div className="size-10 rounded-xl bg-brand-pink/10 text-brand-pink flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Icon className="size-5" />
        </div>
        <h3 className="font-heading font-bold text-foreground text-base mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        {children}
      </div>
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-pink/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

/* ─── Animated counter ──────────────────────────────────────────────── */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: target,
      duration: 2,
      ease: "power2.out",
      onUpdate: () => { el.textContent = Math.round(obj.val) + suffix; },
    });
    return () => { tween.kill(); };
  }, [target, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

/* ─── Main Landing Page ─────────────────────────────────────────────── */
export default function LandingPage() {
  const { token } = useSession();
  const [copiedCode, setCopiedCode] = useState(false);

  const heroRef = useGsap<HTMLDivElement>((container) => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(container.querySelector(".hero-badge"), { y: 20, autoAlpha: 0, duration: 0.6 })
      .from(container.querySelector(".hero-title"), { y: 40, autoAlpha: 0, duration: 0.8 }, "-=0.3")
      .from(container.querySelector(".hero-subtitle"), { y: 30, autoAlpha: 0, duration: 0.6 }, "-=0.4")
      .from(container.querySelector(".hero-cta"), { y: 20, autoAlpha: 0, duration: 0.5 }, "-=0.3")
      .from(container.querySelector(".hero-dashboard"), { y: 60, autoAlpha: 0, duration: 1, ease: "power2.out" }, "-=0.4");
  });

  const bentoRef = useGsap<HTMLDivElement>((container) => {
    gsap.from(container.querySelectorAll(".bento-item"), {
      y: 40,
      autoAlpha: 0,
      stagger: 0.08,
      duration: 0.7,
      ease: "power2.out",
      scrollTrigger: undefined, // ponytail: no ScrollTrigger dependency, just entrance
    });
  });

  const stepsRef = useGsap<HTMLDivElement>((container) => {
    gsap.from(container.querySelectorAll(".step-card"), {
      x: -30,
      autoAlpha: 0,
      stagger: 0.12,
      duration: 0.6,
      ease: "power2.out",
    });
  });

  function copyCode() {
    navigator.clipboard.writeText(
      `npm install @strim/sdk\n\nimport { strim } from "@strim/sdk";\nstrim.init({\n  projectId: "my-app",\n  environment: "production",\n  apiKey: process.env.STRIM_API_KEY\n});`
    );
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Navigation ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-full bg-brand-pink flex items-center justify-center font-bold text-white shadow-xs group-hover:scale-105 transition-transform">
              S
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              STRIM
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#sdk" className="hover:text-foreground transition-colors">Developers</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Customers</a>
          </nav>

          <div className="flex items-center gap-3">
            {token ? (
              <Link
                href="/runtime"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-9 rounded-full px-5 font-bold text-xs bg-[#0D0C22] text-white hover:bg-[#1E1D38] dark:bg-white dark:text-[#0D0C22]",
                )}
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-9 rounded-full px-4 text-xs font-semibold",
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-9 rounded-full px-5 font-bold text-xs bg-[#0D0C22] text-white hover:opacity-90 dark:bg-white dark:text-[#0D0C22]",
                  )}
                >
                  Get Started
                </Link>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-brand-pink/8 blur-[120px] pointer-events-none" />
        <div className="absolute top-36 right-1/4 size-[400px] rounded-full bg-brand-lime/8 blur-[100px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 text-center space-y-8 relative z-10">
          {/* Badge */}
          <div className="hero-badge inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 bg-secondary border border-border text-xs font-semibold shadow-2xs">
            <span className="size-2 rounded-full bg-brand-lime animate-pulse" />
            <span className="text-muted-foreground">Deploy with confidence</span>
            <span className="text-border">|</span>
            <span className="text-brand-pink font-bold">Strim v1.0</span>
          </div>

          {/* Headline */}
          <h1 className="hero-title font-heading text-5xl md:text-7xl font-black tracking-tight leading-[1.05] text-foreground">
            Ship changes<br />
            <span className="text-brand-pink">without the fear.</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
            Simulate traffic, test your changes against real-world scenarios,
            and roll out safely with automatic rollbacks. No more 2 AM incidents.
          </p>

          {/* CTA */}
          <div className="hero-cta flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 rounded-full px-8 font-bold text-sm bg-[#0D0C22] text-white hover:bg-[#1E1D38] dark:bg-white dark:text-[#0D0C22] shadow-lg gap-2",
              )}
            >
              Start Free Trial
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 rounded-full px-8 font-bold text-sm gap-2",
              )}
            >
              <Play className="size-4" />
              See Live Demo
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-4 flex-wrap">
            {["No credit card needed", "5-minute setup", "Free forever for small teams"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>

          {/* Dashboard Preview */}
          <div className="hero-dashboard pt-8">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* ── Stats Bar ───────────────────────────────────────────────── */}
      <section className="border-y border-border bg-secondary/30 py-12">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 99.9, suffix: "%", label: "Uptime guaranteed" },
            { value: 50, suffix: "ms", label: "Avg response time" },
            { value: 10, suffix: "k+", label: "Deployments protected" },
            { value: 500, suffix: "+", label: "Teams trust Strim" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-heading font-black text-foreground">
                <Counter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bento Features Grid ─────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-pink mb-3">Everything you need</p>
            <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Deploy safely, every single time
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              From simulation to production, Strim watches every step so you don&apos;t have to.
            </p>
          </div>

          <div ref={bentoRef} className="grid md:grid-cols-3 gap-4">
            {/* Large card spanning 2 cols */}
            <BentoCard
              icon={Activity}
              title="Live Dashboard"
              description="See your app's health, traffic, and response times updating in real time. No jargon, just clear numbers."
              className="bento-item md:col-span-2 md:row-span-2"
            >
              {/* Mini chart animation */}
              <div className="mt-4 flex items-end gap-1 h-16 opacity-60">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-brand-pink/40 rounded-t-sm animate-pulse"
                    style={{
                      height: `${30 + Math.sin(i * 0.8) * 40 + 30}%`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            </BentoCard>

            <BentoCard
              icon={Zap}
              title="What-If Simulations"
              description="Test 2x traffic, cache failures, or slow dependencies before they hit production."
              className="bento-item"
            />

            <BentoCard
              icon={ShieldCheck}
              title="Safe Rollouts"
              description="Deploy to 10% → 25% → 50% → 100% of users. Auto-rollback if anything goes wrong."
              className="bento-item"
            />

            <BentoCard
              icon={RotateCcw}
              title="1-Click Rollback"
              description="Something broke? Roll back to the last known good state instantly."
              className="bento-item"
            />

            <BentoCard
              icon={BarChart3}
              title="Load Testing"
              description="Stress-test your services with realistic traffic patterns before launch day."
              className="bento-item"
            />

            <BentoCard
              icon={Globe}
              title="Service Map"
              description="Visualize how your services connect and which ones a change might affect."
              className="bento-item"
            />
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-secondary/20 border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-pink mb-3">Simple as 1-2-3</p>
            <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tight text-foreground">
              How Strim works
            </h2>
          </div>

          <div ref={stepsRef} className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: Sparkles,
                title: "Connect your app",
                description: "Install our lightweight SDK or connect via API. Takes less than 5 minutes.",
              },
              {
                step: "2",
                icon: Play,
                title: "Simulate & test",
                description: "Run what-if simulations against real traffic patterns. See exactly what would happen.",
              },
              {
                step: "3",
                icon: ShieldCheck,
                title: "Ship with confidence",
                description: "Deploy with staged rollouts and automatic rollbacks. Sleep through the night.",
              },
            ].map((s) => (
              <div key={s.step} className="step-card text-center">
                <div className="size-14 rounded-2xl bg-brand-pink/10 text-brand-pink flex items-center justify-center mx-auto mb-4">
                  <s.icon className="size-6" />
                </div>
                <div className="text-xs font-bold text-brand-pink mb-2">Step {s.step}</div>
                <h3 className="font-heading font-bold text-foreground text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SDK Section ─────────────────────────────────────────────── */}
      <section id="sdk" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-pink mb-3">For developers</p>
            <h2 className="font-heading text-3xl font-black tracking-tight text-foreground mb-4">
              Set up in 5 minutes
            </h2>
            <p className="text-muted-foreground mb-6">
              One package. A few lines of code. Your app is now protected by Strim&apos;s
              safety net — simulations, rollouts, and instant rollbacks.
            </p>
            <div className="flex gap-3">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "h-9 rounded-full px-5 font-bold text-xs bg-[#0D0C22] text-white hover:opacity-90 dark:bg-white dark:text-[#0D0C22] gap-1.5",
                )}
              >
                Get your API key
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Code block */}
          <div className="rounded-2xl border border-border bg-[#0E0D1E] text-white overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#232242]">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-red-400" />
                <span className="size-2.5 rounded-full bg-amber-400" />
                <span className="size-2.5 rounded-full bg-emerald-400" />
              </div>
              <button
                type="button"
                onClick={copyCode}
                className="text-[10px] text-[#8E8D9F] hover:text-white transition-colors font-mono"
              >
                {copiedCode ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-[#8E8D9F]">{"// Install the SDK\n"}</span>
                <span className="text-brand-lime">npm install</span>{" @strim/sdk\n\n"}
                <span className="text-[#8E8D9F]">{"// Add to your app\n"}</span>
                <span className="text-brand-pink">import</span>{" { strim } "}
                <span className="text-brand-pink">from</span>{" "}
                <span className="text-brand-lime">{'"@strim/sdk"'}</span>{";\n\n"}
                {"strim."}
                <span className="text-brand-gold">init</span>
                {"({\n"}
                {"  projectId: "}
                <span className="text-brand-lime">{'"my-app"'}</span>{",\n"}
                {"  environment: "}
                <span className="text-brand-lime">{'"production"'}</span>{",\n"}
                {"  apiKey: process.env.STRIM_API_KEY\n"}
                {"});"}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 bg-secondary/20 border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-pink mb-3">Loved by teams</p>
            <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tight text-foreground">
              Teams ship faster with Strim
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "We used to spend hours on deployment reviews. Now Strim simulates everything automatically.",
                name: "Sarah Chen",
                role: "VP Engineering, Acme Corp",
              },
              {
                quote: "The 1-click rollback saved us twice last month. Worth every penny.",
                name: "Marcus Rivera",
                role: "CTO, Relay Payments",
              },
              {
                quote: "Finally, a deployment tool that doesn't require a PhD to understand. Our whole team uses it.",
                name: "Priya Sharma",
                role: "Lead Developer, CloudNine",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-border bg-card p-6 hover:border-brand-pink/30 transition-all"
              >
                <div className="flex gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-gradient-to-br from-brand-pink to-brand-gold flex items-center justify-center text-white text-xs font-bold">
                    {t.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="rounded-3xl bg-[#0E0D1E] text-white p-12 md:p-16 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 size-64 rounded-full bg-brand-pink/20 blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-brand-lime/15 blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tight mb-4">
                Ready to deploy<br />without the drama?
              </h2>
              <p className="text-[#8E8D9F] mb-8 max-w-md mx-auto">
                Join hundreds of teams who ship changes with confidence. Free for small teams, forever.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 rounded-full px-8 font-bold text-sm bg-brand-pink text-white hover:bg-brand-pink/90 gap-2",
                  )}
                >
                  Start Free Trial
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-12 rounded-full px-8 font-bold text-sm border-[#232242] text-white hover:bg-[#1E1D38] gap-2",
                  )}
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-12 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-7 rounded-full bg-brand-pink flex items-center justify-center font-bold text-white text-xs">
                  S
                </div>
                <span className="font-heading font-bold text-foreground">STRIM</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deploy with confidence. Simulate, test, and ship — without the fear.
              </p>
            </div>

            {/* Links */}
            {[
              {
                title: "Product",
                links: ["Dashboard", "Simulations", "Load Tests", "Service Map"],
              },
              {
                title: "Company",
                links: ["About", "Blog", "Careers", "Contact"],
              },
              {
                title: "Resources",
                links: ["Documentation", "API Reference", "Status Page", "Changelog"],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-bold text-foreground mb-3">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                        {link}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} Strim Labs. All rights reserved.</p>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="hover:text-foreground cursor-pointer">Privacy</span>
              <span className="hover:text-foreground cursor-pointer">Terms</span>
              <span className="hover:text-foreground cursor-pointer">Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
