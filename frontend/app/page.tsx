import { LandingNavbar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { WorkflowSection } from "@/components/landing/workflow-section"
import { ProductPillars } from "@/components/landing/product-pillars"
import { TerminalDemo } from "@/components/landing/terminal-demo"
import { SecurityTrust } from "@/components/landing/security-trust"
import { FAQSection } from "@/components/landing/faq-section"
import { CTASection } from "@/components/landing/cta-section"
import { LandingFooter } from "@/components/landing/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-brand/30 selection:text-foreground">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <ProductPillars />
        <WorkflowSection />
        <TerminalDemo />
        <SecurityTrust />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
