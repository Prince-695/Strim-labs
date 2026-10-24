"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Org = { id: string; name: string; slug: string; role: string };
export type Project = { id: string; name: string; targetUrl: string; defaultMethod: string };

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

let cachedSnapshot: Stored = { token: null, orgs: [] };
let initialLoaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Stored {
  if (!initialLoaded && typeof window !== "undefined") {
    cachedSnapshot = readStored();
    initialLoaded = true;
  }
  return cachedSnapshot;
}

const SERVER_SNAPSHOT: Stored = { token: null, orgs: [] };
function getServerSnapshot(): Stored {
  return SERVER_SNAPSHOT;
}

function writeStored(next: Stored) {
  if (next.token) localStorage.setItem("strim_token", next.token);
  else localStorage.removeItem("strim_token");
  localStorage.setItem("strim_orgs", JSON.stringify(next.orgs));
  cachedSnapshot = next;
  emit();
}

type Session = {
  token: string | null;
  orgs: Org[];
  orgId: string | null;
  projects: Project[];
  projectId: string | null;
  loading: boolean;
  setSession: (token: string, orgs: Org[]) => void;
  clear: () => void;
  setOrgId: (id: string) => void;
  setProjectId: (id: string) => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const token = stored.token;
  const orgs = stored.orgs;
  const activeOrgId = orgId ?? orgs[0]?.id ?? null;

  const projectsQuery = useQuery({
    queryKey: ["projects", activeOrgId],
    enabled: Boolean(token && activeOrgId),
    queryFn: () => api<{ projects: Project[] }>("/v1/projects", { token, orgId: activeOrgId }),
  });

  const projects = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data?.projects]);
  const activeProjectId = projectId ?? projects[0]?.id ?? null;

  const setSession = useCallback((nextToken: string, nextOrgs: Org[]) => {
    writeStored({ token: nextToken, orgs: nextOrgs });
    setOrgId(nextOrgs[0]?.id ?? null);
  }, []);

  const clear = useCallback(() => {
    writeStored({ token: null, orgs: [] });
    setOrgId(null);
    setProjectId(null);
  }, []);

  const value = useMemo<Session>(
    () => ({
      token,
      orgs,
      orgId: activeOrgId,
      projects,
      projectId: activeProjectId,
      loading: Boolean(token && activeOrgId && projectsQuery.isLoading),
      setSession,
      clear,
      setOrgId,
      setProjectId,
    }),
    [token, orgs, activeOrgId, projects, activeProjectId, projectsQuery.isLoading, setSession, clear],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
