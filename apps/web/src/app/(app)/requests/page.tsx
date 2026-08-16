"use client";
import GenericList from "@/components/ListPage";
export default function Page() {
  return <GenericList title="Requests" path="/v1/requests" keyName="requests" />;
}
