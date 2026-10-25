"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function RunnerRedirect() {
  const router = useRouter();
  const { projectId } = useSession();

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}/runner`);
    } else {
      router.replace("/projects");
    }
  }, [router, projectId]);

  return null;
}
