"use client";
import GenericList from "@/components/ListPage";
export default function Page() {
  return <GenericList title="Audit" path="/v1/audit" keyName="logs" />;
}
