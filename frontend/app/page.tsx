import { Navbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { MarqueeTicker } from "@/components/landing/marquee-ticker"
import { Explore } from "@/components/landing/explore"
import { Stats } from "@/components/landing/stats"
import { PlatformBento } from "@/components/landing/platform-bento"
import { PipelineProofs } from "@/components/landing/pipeline-proofs"
import { LiveTrafficTerminal } from "@/components/landing/live-traffic-terminal"
import { InstallWidget } from "@/components/landing/install-widget"
import { FAQSection } from "@/components/landing/faq-section"
import { CTA } from "@/components/landing/CallToAction"
import { Footer } from "@/components/landing/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-brand/30 selection:text-foreground">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <MarqueeTicker />
        <Explore />
        <Stats />
        <PlatformBento />
        <PipelineProofs />
        <LiveTrafficTerminal />
        <InstallWidget />
        <FAQSection />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
