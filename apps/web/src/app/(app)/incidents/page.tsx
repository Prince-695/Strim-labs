"use client";
import GenericList from "@/components/ListPage";
export default function Page() {
  return <GenericList title="Incidents" path="/v1/incidents" keyName="incidents" />;
}
