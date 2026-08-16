"use client";
import GenericList from "@/components/ListPage";
export default function Page() {
  return <GenericList title="Cache" path="/v1/cache/rules" keyName="rules" />;
}
