import { HomeSwitch } from "@/components/home-switch";
import { Hero } from "@/components/marketing/hero";
import { BentoGrid } from "@/components/marketing/bento-grid";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { SecuritySection, SectionHeading, SpectrumSection, WorkflowSection, FinalCta } from "@/components/marketing/sections";
import { Simulator } from "@/components/marketing/simulator";
import { Reveal } from "@/components/fx/reveal";

export default function HomePage() {
  return (
    <HomeSwitch>
      <MarketingHeader />
      <main id="main">
        <Hero />
        <BentoGrid />

        <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
          <SectionHeading title="Watch a load test unfold" body="Pick a preset and replay it. Every real run produces the same two lines: throughput and tail latency, sampled every 500 ms." />
          <Reveal className="mt-10">
            <Simulator />
          </Reveal>
        </section>

        <SpectrumSection />
        <WorkflowSection />
        <SecuritySection />
        <FinalCta />
      </main>
      <MarketingFooter />
    </HomeSwitch>
  );
}
