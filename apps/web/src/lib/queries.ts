"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "./session";
import type { ComparisonResult, DiscoveredEndpoint, DiscoveryResult, OrgDetail, Project, TestRun } from "./types";

export function useRuns(projectId: string | null, opts: { refetchMs?: number } = {}) {
  const { call, orgId, token } = useSession();
  return useQuery({
    queryKey: ["runs", orgId, projectId],
    enabled: Boolean(token && orgId && projectId),
    refetchInterval: opts.refetchMs,
    queryFn: async () => (await call<{ runs: TestRun[] }>(`/v1/load-tests?projectId=${encodeURIComponent(projectId ?? "")}`)).runs,
  });
}

/** `pollMs` polls only while the run is still QUEUED/RUNNING, then stops by itself. */
export function useRun(id: string | null | undefined, opts: { pollMs?: number } = {}) {
  const { call, orgId, token } = useSession();
  return useQuery({
    queryKey: ["run", orgId, id],
    enabled: Boolean(token && orgId && id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return opts.pollMs && (status === "RUNNING" || status === "QUEUED") ? opts.pollMs : false;
    },
    queryFn: async () => (await call<{ run: TestRun }>(`/v1/load-tests/${id}`)).run,
  });
}

export function useComparison(runA: string | null, runB: string | null) {
  const { call, orgId, token } = useSession();
  return useQuery({
    queryKey: ["compare", orgId, runA, runB],
    enabled: Boolean(token && orgId && runA && runB),
    queryFn: async () =>
      (await call<{ comparison: ComparisonResult }>(`/v1/compare?runA=${runA}&runB=${runB}`)).comparison,
  });
}

export function useOrgDetail() {
  const { call, orgId, token } = useSession();
  return useQuery({
    queryKey: ["org", orgId],
    enabled: Boolean(token && orgId),
    queryFn: async () => (await call<{ org: OrgDetail }>("/v1/org")).org,
  });
}

export type NewProject = {
  name: string;
  baseUrl?: string;
  targetUrl?: string;
  defaultMethod?: string;
  defaultHeaders?: Record<string, string>;
};

export type CreatedProjectResult = {
  project: Project;
  apiKey: string;
};

/** Creates a project and returns the newly generated API key */
export function useCreateProject() {
  const { call, setProjectId, orgId } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: NewProject) =>
      await call<CreatedProjectResult>("/v1/projects", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["projects", orgId] });
      setProjectId(data.project.id);
    },
  });
}

export function useDeleteProject() {
  const { call, orgId } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => call<unknown>(`/v1/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", orgId] }),
  });
}

export function useProjectObservability(projectId: string | null, opts: { refetchMs?: number } = {}) {
  const { call, orgId, token } = useSession();
  return useQuery({
    queryKey: ["project-observability", orgId, projectId],
    enabled: Boolean(token && orgId && projectId),
    refetchInterval: opts.refetchMs ?? 5000,
    queryFn: async () =>
      (await call<{ project: Project; observability: any }>(`/v1/projects/${projectId}/observability`)).observability,
  });
}

export function useDiscoveredRoutes(projectId: string | null, opts: { refetchMs?: number } = {}) {
  const { call, orgId, token } = useSession();
  return useQuery({
    queryKey: ["discovered-routes", orgId, projectId],
    enabled: Boolean(token && orgId && projectId),
    refetchInterval: opts.refetchMs ?? 10000,
    queryFn: async () =>
      (await call<{ routes: any[]; total: number }>(`/v1/projects/${projectId}/discovered-routes`)).routes,
  });
}

export function useRegenerateApiKey() {
  const { call, orgId } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) =>
      await call<{ project: Project; apiKey: string }>(`/v1/projects/${projectId}/api-key/regenerate`, {
        method: "POST",
      }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["projects", orgId] });
      await qc.invalidateQueries({ queryKey: ["project-observability", orgId, data.project.id] });
    },
  });
}

export function useUserOrgs() {
  const { call, token } = useSession();
  return useQuery({
    queryKey: ["user-orgs"],
    enabled: Boolean(token),
    queryFn: async () => (await call<{ orgs: any[]; maxOrgs: number }>("/v1/org/user-orgs")),
  });
}

export function useCreateOrg() {
  const { call } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string }) =>
      await call<{ org: any }>("/v1/org", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["user-orgs"] });
    },
  });
}

export function useDiscoveryScan() {
  const { call } = useSession();
  return useMutation({
    mutationFn: async (body: { baseUrl: string; headers?: Record<string, string> }) =>
      (await call<{ ok: boolean; result: DiscoveryResult }>("/v1/discovery/scan", {
        method: "POST",
        body: JSON.stringify(body),
      })).result,
  });
}

export function useImportDiscoveredEndpoints() {
  const { call, orgId, setProjectId } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { baseUrl: string; endpoints: DiscoveredEndpoint[] }) =>
      await call<{ ok: boolean; count: number; projects: Project[] }>("/v1/discovery/import", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["projects", orgId] });
      if (data.projects[0]) {
        setProjectId(data.projects[0].id);
      }
    },
  });
}

