"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function TestsRedirect() {
  const router = useRouter();
  const { projectId } = useSession();

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}/tests`);
    } else {
      router.replace("/projects");
    }
  }, [router, projectId]);

  return null;
}
