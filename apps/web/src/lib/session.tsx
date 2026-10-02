"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Org = { id: string; name: string; slug: string; role: string };
export type EnvNode = { id: string; name: string; type: string };
export type AppNode = { id: string; name: string; environments: EnvNode[] };
export type ProjectNode = { id: string; name: string; applications: AppNode[] };
export type WorkspaceNode = { id: string; name: string; projects: ProjectNode[] };

type Stored = { token: string | null; orgs: Org[] };

function readStored(): Stored {
  if (typeof window === "undefined") return { token: null, orgs: [] };
  try {
    const token = localStorage.getItem("strim_token");
    const raw = localStorage.getItem("strim_orgs");
    return { token, orgs: raw ? (JSON.parse(raw) as Org[]) : [] };
  } catch {
    return { token: null, orgs: [] };
  }
}

let memory: Stored = { token: null, orgs: [] };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Stored {
  const next = readStored();
  if (memory.token === next.token && JSON.stringify(memory.orgs) === JSON.stringify(next.orgs)) {
    return memory;
  }
  memory = next;
  return memory;
}

const SERVER_SNAPSHOT: Stored = { token: null, orgs: [] };

function getServerSnapshot(): Stored {
  return SERVER_SNAPSHOT;
}

function writeStored(next: Stored) {
  if (next.token) localStorage.setItem("strim_token", next.token);
  else localStorage.removeItem("strim_token");
  localStorage.setItem("strim_orgs", JSON.stringify(next.orgs));
  memory = next;
  emit();
}

type Session = {
  token: string | null;
  orgs: Org[];
  orgId: string | null;
  workspaces: WorkspaceNode[];
  workspaceId: string | null;
  projectId: string | null;
  applicationId: string | null;
  environmentId: string | null;
  loading: boolean;
  setSession: (token: string, orgs: Org[]) => void;
  clear: () => void;
  setOrgId: (id: string) => void;
  setWorkspaceId: (id: string) => void;
  setProjectId: (id: string) => void;
  setApplicationId: (id: string) => void;
  setEnvironmentId: (id: string) => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);

  const token = stored.token;
  const orgs = stored.orgs;
  const activeOrgId = orgId ?? orgs[0]?.id ?? null;

  const contextQuery = useQuery({
    queryKey: ["org-context", activeOrgId],
    enabled: Boolean(token && activeOrgId),
    queryFn: () => api<{ workspaces: WorkspaceNode[] }>("/v1/org/context", { token, orgId: activeOrgId }),
  });

  const workspaces = useMemo(() => contextQuery.data?.workspaces ?? [], [contextQuery.data?.workspaces]);
  const activeWorkspaceId = workspaceId ?? workspaces[0]?.id ?? null;
  const projects = workspaces.find((w) => w.id === activeWorkspaceId)?.projects ?? [];
  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const apps = projects.find((p) => p.id === activeProjectId)?.applications ?? [];
  const activeApplicationId = applicationId ?? apps[0]?.id ?? null;
  const envs = apps.find((a) => a.id === activeApplicationId)?.environments ?? [];
  const activeEnvironmentId =
    environmentId ?? envs.find((e) => e.type === "PRODUCTION")?.id ?? envs[0]?.id ?? null;

  const setSession = useCallback((nextToken: string, nextOrgs: Org[]) => {
    writeStored({ token: nextToken, orgs: nextOrgs });
    setOrgId(nextOrgs[0]?.id ?? null);
  }, []);

  const clear = useCallback(() => {
    writeStored({ token: null, orgs: [] });
    setOrgId(null);
    setWorkspaceId(null);
    setProjectId(null);
    setApplicationId(null);
    setEnvironmentId(null);
  }, []);

  const value = useMemo<Session>(
    () => ({
      token,
      orgs,
      orgId: activeOrgId,
      workspaces,
      workspaceId: activeWorkspaceId,
      projectId: activeProjectId,
      applicationId: activeApplicationId,
      environmentId: activeEnvironmentId,
      loading: Boolean(token && activeOrgId && contextQuery.isLoading),
      setSession,
      clear,
      setOrgId,
      setWorkspaceId,
      setProjectId,
      setApplicationId,
      setEnvironmentId,
    }),
    [
      token,
      orgs,
      activeOrgId,
      workspaces,
      activeWorkspaceId,
      activeProjectId,
      activeApplicationId,
      activeEnvironmentId,
      contextQuery.isLoading,
      setSession,
      clear,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
