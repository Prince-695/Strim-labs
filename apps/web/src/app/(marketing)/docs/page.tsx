import type { Metadata } from "next";
import { DocsView } from "@/components/marketing/docs-view";

export const metadata: Metadata = {
  title: "Documentation — STRIM Labs",
  description:
    "Quickstart guide, load presets, saturation capacity calculations, REST API reference, and CI/CD integration.",
};

export default function DocsPage() {
  return (
    <div className="py-8">
      <DocsView />
    </div>
  );
}
