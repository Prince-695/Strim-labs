import type { Metadata } from "next";
import { DocsView } from "@/components/marketing/docs-view";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";

export const metadata: Metadata = {
  title: "Documentation",
  description: "STRIM quickstart, the four load presets, capacity and telemetry explained, the REST API and CI/CD integration.",
};

export default function DocsPage() {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="pt-16">
        <DocsView />
      </main>
      <MarketingFooter />
    </>
  );
}
