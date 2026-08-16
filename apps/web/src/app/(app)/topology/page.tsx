"use client";
import GenericList from "@/components/ListPage";
export default function Page() {
  return <GenericList title="Topology" path="/v1/topology" keyName="nodes" />;
}
