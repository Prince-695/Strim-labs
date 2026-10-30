"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";

function OnboardingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token");
  const { isReady, isAuthenticated, token, orgs, currentOrgId, setSession } = useAuth();

  // If token is in URL (from OAuth redirect), store it
  useEffect(() => {
    if (urlToken) {
      fetchApi<{ user: Schemas["User"] } | Schemas["User"]>("/api/v1/users/me", { token: urlToken })
        .then((res) => {
          const userObj = res && typeof res === "object" && "user" in res && res.user
            ? res.user
            : (res as Schemas["User"]);
          setSession(urlToken, userObj);
        })
        .catch(() => {
          router.replace("/sign-in");
        });
    }
  }, [urlToken, setSession, router]);

  const effectiveOrgId = currentOrgId || orgs[0]?.id;

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: effectiveOrgId ? queryKeys.projects.all(effectiveOrgId) : ["no-org"],
    enabled: Boolean(token && effectiveOrgId),
    queryFn: async () => {
      const res = await fetchApi<{ projects: Schemas["Project"][]; total: number }>(
        `/api/v1/organizations/${effectiveOrgId}/projects`
      );
      return res.projects;
    },
  });

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated && !urlToken) {
      router.replace("/sign-in");
      return;
    }

    if (orgs.length === 0) {
      router.replace("/onboarding/organization");
      return;
    }

    const projectsList = Array.isArray(projects)
      ? projects
      : (projects && typeof projects === "object" && Array.isArray((projects as any).projects)
          ? (projects as any).projects
          : []);

    if (effectiveOrgId && !projectsLoading && projects) {
      if (projectsList.length === 0) {
        router.replace("/onboarding/project");
      } else if (projectsList[0]?.id) {
        router.replace(
          `/app/organizations/${effectiveOrgId}/projects/${projectsList[0].id}`
        );
      }
    }
  }, [isReady, isAuthenticated, urlToken, orgs, effectiveOrgId, projectsLoading, projects, router]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
      <Loader2 className="size-8 animate-spin text-brand" />
      <p className="text-sm font-medium text-muted-foreground">Setting up your STRIM console...</p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Initializing onboarding...</div>}>
      <OnboardingRedirect />
    </Suspense>
  );
}
