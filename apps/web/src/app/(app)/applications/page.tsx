"use client";
import GenericList from "@/components/ListPage";
export default function Page() {
  return <GenericList title="Applications" path="/v1/org/applications" keyName="applications" />;
}
