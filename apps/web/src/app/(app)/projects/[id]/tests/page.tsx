"use client";

import { useParams } from "next/navigation";
import { TestHistoryView } from "@/components/tests/test-history-view";

export default function ProjectTestsPage() {
  const params = useParams<{ id: string }>();
  return <TestHistoryView projectId={params?.id} />;
}
