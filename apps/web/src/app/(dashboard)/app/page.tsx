"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Activity } from "lucide-react";

export default function AppPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, currentOrgId, orgs } = useAuth();

  const targetOrgId = currentOrgId || orgs[0]?.id;

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: targetOrgId ? queryKeys.projects.all(targetOrgId) : ["no-org"],
    enabled: Boolean(isReady && isAuthenticated && targetOrgId),
    queryFn: async () => {
      const res = await fetchApi<{ projects: Schemas["Project"][]; total: number }>(
        `/api/v1/organizations/${targetOrgId}/projects`
      );
      return res.projects;
    },
  });

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/sign-in");
      return;
    }

    if (orgs.length === 0) {
      router.replace("/onboarding/organization");
      return;
    }

    const projectsList = Array.isArray(projectsData)
      ? projectsData
      : (projectsData && typeof projectsData === "object" && Array.isArray((projectsData as any).projects)
          ? (projectsData as any).projects
          : []);

    if (!projectsLoading) {
      if (projectsList.length > 0 && projectsList[0]?.id) {
        router.replace(`/app/organizations/${targetOrgId}/projects/${projectsList[0].id}`);
      } else if (targetOrgId) {
        router.replace(`/app/organizations/${targetOrgId}`);
      }
    }
  }, [isReady, isAuthenticated, orgs, projectsLoading, projectsData, targetOrgId, router]);

  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand animate-pulse">
        <Activity className="size-6" />
      </div>
      <p className="font-mono text-xs text-muted-foreground animate-pulse">
        Resolving workspace context...
      </p>
    </div>
  );
}
