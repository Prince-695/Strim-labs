import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard-view";

export const metadata: Metadata = {
  title: "Capacity Dashboard — STRIM Labs",
  description: "Live overview of API capacity, breaking point saturation, and recent benchmark runs.",
};

export default function DashboardPage() {
  return <DashboardView />;
}
