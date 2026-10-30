import { HomeSwitch } from "@/components/home-switch";
import { ProblemFunnel } from "@/components/marketing/problem-funnel";
import { SolutionDiscovery } from "@/components/marketing/solution-discovery";
import { FeatureDeepDive } from "@/components/marketing/feature-deep-dive";
import { SaturationGlobeSection } from "@/components/marketing/saturation-globe-section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FinalCtaTriptych } from "@/components/marketing/final-cta-triptych";
import { Hero } from "@/components/marketing/hero";

export default function HomePage() {
  return (
    <HomeSwitch>
      <div className="min-h-screen bg-background">
        <Hero />
        <ProblemFunnel />
        <SolutionDiscovery />
        <FeatureDeepDive />
        <SaturationGlobeSection />
        <FaqAccordion />
        <FinalCtaTriptych />
      </div>
    </HomeSwitch>
  );
}
