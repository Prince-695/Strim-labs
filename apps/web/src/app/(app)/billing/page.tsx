"use client";
import GenericList from "@/components/ListPage";
export default function Page() {
  return <GenericList title="Billing" path="/v1/billing" keyName="usage" />;
}
