"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { api, type ApiInit } from "./api";
import type { Org, Project } from "./types";

/**
 * Session architecture
 * - Source of truth: localStorage (`strim_token`, `strim_orgs`, `strim_org_id`, `strim_project_id`).
 * - Read through useSyncExternalStore with primitive (string) snapshots, so it is hydration-safe and never loops.
 * - Projects (a.k.a. target APIs) are server state and live in react-query under ["projects", orgId].
 */

const KEYS = {
  token: "strim_token",
  orgs: "strim_orgs",
  orgId: "strim_org_id",
  projectId: "strim_project_id",
  user: "strim_user",
} as const;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — session simply won't persist */
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
const noopSubscribe = () => () => undefined;

/** Lets the query layer sign the user out when any request returns 401. */
let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized() {
  unauthorizedHandler?.();
}

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type SessionValue = {
  /** False during SSR and the first client render; true once localStorage has been read. */
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  orgs: Org[];
  org: Org | null;
  orgId: string | null;
  projects: Project[];
  projectsLoading: boolean;
  projectsError: boolean;
  project: Project | null;
  projectId: string | null;
  setSession: (token: string, orgs: Org[], user?: AuthUser) => void;
  clear: () => void;
  setOrgId: (id: string) => void;
  setProjectId: (id: string) => void;
  refreshProjects: () => Promise<unknown>;
  refreshOrgs: () => Promise<unknown>;
  /** Authenticated fetch bound to the current token + organization. */
  call: <T>(path: string, init?: ApiInit) => Promise<T>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const token = useSyncExternalStore(subscribe, () => read(KEYS.token), () => null);
  const orgsRaw = useSyncExternalStore(subscribe, () => read(KEYS.orgs), () => null);
  const userRaw = useSyncExternalStore(subscribe, () => read(KEYS.user), () => null);
  const storedOrgId = useSyncExternalStore(subscribe, () => read(KEYS.orgId), () => null);
  const storedProjectId = useSyncExternalStore(subscribe, () => read(KEYS.projectId), () => null);

  const parsedUser = useMemo<AuthUser | null>(() => {
    if (!userRaw) return null;
    try {
      return JSON.parse(userRaw);
    } catch {
      return null;
    }
  }, [userRaw]);

  const call = useCallback(
    <T,>(path: string, init: ApiInit = {}) => api<T>(path, { token, orgId: storedOrgId, ...init }),
    [token, storedOrgId],
  );

  // Fetch current user details from /v1/auth/me if not cached
  const userQuery = useQuery({
    queryKey: ["auth-me", token],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await call<{ user: AuthUser; orgs: Org[] }>("/v1/auth/me");
      write(KEYS.user, JSON.stringify(res.user));
      write(KEYS.orgs, JSON.stringify(res.orgs));
      emit();
      return res;
    },
  });

  const user = userQuery.data?.user ?? parsedUser;

  const orgs = useMemo<Org[]>(() => {
    const raw = userQuery.data?.orgs ? JSON.stringify(userQuery.data.orgs) : orgsRaw;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Org[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [orgsRaw, userQuery.data?.orgs]);

  const org = useMemo(() => orgs.find((o) => o.id === storedOrgId) ?? orgs[0] ?? null, [orgs, storedOrgId]);
  const orgId = org?.id ?? null;

  const setSession = useCallback((nextToken: string, nextOrgs: Org[], nextUser?: AuthUser) => {
    write(KEYS.token, nextToken);
    write(KEYS.orgs, JSON.stringify(nextOrgs));
    write(KEYS.orgId, nextOrgs[0]?.id ?? null);
    write(KEYS.projectId, null);
    if (nextUser) write(KEYS.user, JSON.stringify(nextUser));
    emit();
  }, []);

  const clear = useCallback(() => {
    write(KEYS.token, null);
    write(KEYS.orgs, null);
    write(KEYS.orgId, null);
    write(KEYS.projectId, null);
    write(KEYS.user, null);
    emit();
    queryClient.clear();
    router.replace("/login");
  }, [queryClient, router]);

  unauthorizedHandler = token ? clear : null;

  const setOrgId = useCallback(
    (id: string) => {
      write(KEYS.orgId, id);
      write(KEYS.projectId, null);
      emit();
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const setProjectId = useCallback((id: string) => {
    write(KEYS.projectId, id);
    emit();
  }, []);

  const projectsQuery = useQuery({
    queryKey: ["projects", orgId],
    enabled: Boolean(token && orgId),
    queryFn: async () => (await call<{ projects: Project[] }>("/v1/projects")).projects,
  });

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const project = useMemo(
    () => projects.find((p) => p.id === storedProjectId) ?? projects[0] ?? null,
    [projects, storedProjectId],
  );

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      token,
      user,
      orgs,
      org,
      orgId,
      projects,
      projectsLoading: projectsQuery.isLoading,
      projectsError: projectsQuery.isError,
      project,
      projectId: project?.id ?? null,
      setSession,
      clear,
      setOrgId,
      setProjectId,
      refreshProjects: () => queryClient.invalidateQueries({ queryKey: ["projects", orgId] }),
      refreshOrgs: () => queryClient.invalidateQueries({ queryKey: ["auth-me"] }),
      call,
    }),
    [ready, token, user, orgs, org, orgId, projects, projectsQuery.isLoading, projectsQuery.isError, project, setSession, clear, setOrgId, setProjectId, queryClient, call],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
