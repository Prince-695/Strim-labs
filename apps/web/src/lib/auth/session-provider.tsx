"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  fetchApi,
  setUnauthorizedHandler,
  type Schemas,
} from "../api";
import { queryKeys } from "../api/query-keys";

export type AuthUser = Schemas["User"];
export type AuthOrg = Schemas["Organization"];

const KEYS = {
  token: "strim_token",
  user: "strim_user",
  orgId: "strim_org_id",
  projectId: "strim_project_id",
} as const;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // localStorage unavailable
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", callback);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", callback);
    }
  };
}

const noopSubscribe = () => () => undefined;

interface SessionContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
  orgs: AuthOrg[];
  currentOrg: AuthOrg | null;
  currentOrgId: string | null;
  currentProjectId: string | null;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  switchProject: (projectId: string | null) => void;
  refreshUserData: () => Promise<unknown>;
  setOrgs: (orgs?: any) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const isReady = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const token = useSyncExternalStore(subscribe, () => readStorage(KEYS.token), () => null);
  const cachedUserRaw = useSyncExternalStore(subscribe, () => readStorage(KEYS.user), () => null);
  const storedOrgId = useSyncExternalStore(subscribe, () => readStorage(KEYS.orgId), () => null);
  const storedProjectId = useSyncExternalStore(subscribe, () => readStorage(KEYS.projectId), () => null);

  const cachedUser = useMemo<AuthUser | null>(() => {
    if (!cachedUserRaw) return null;
    try {
      const parsed = JSON.parse(cachedUserRaw);
      return parsed && typeof parsed === "object" && "user" in parsed && parsed.user
        ? (parsed.user as AuthUser)
        : (parsed as AuthUser);
    } catch {
      return null;
    }
  }, [cachedUserRaw]);

  // Query authenticated user details from /api/v1/users/me
  const userQuery = useQuery({
    queryKey: queryKeys.users.me(),
    enabled: Boolean(token),
    queryFn: async () => {
      const data = await fetchApi<{ user: AuthUser } | AuthUser>("/api/v1/users/me");
      const userObj = data && typeof data === "object" && "user" in data && data.user ? data.user : (data as AuthUser);
      writeStorage(KEYS.user, JSON.stringify(userObj));
      emit();
      return userObj;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query user organizations from /api/v1/users/me/organizations
  const orgsQuery = useQuery({
    queryKey: queryKeys.users.organizations(),
    enabled: Boolean(token),
    queryFn: async () => {
      const data = await fetchApi<{ organizations: AuthOrg[] } | AuthOrg[]>("/api/v1/users/me/organizations");
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray((data as any).organizations)) {
        return (data as any).organizations as AuthOrg[];
      }
      return [] as AuthOrg[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const user = userQuery.data ?? cachedUser;
  const orgs = useMemo<AuthOrg[]>(() => {
    const raw = orgsQuery.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object" && Array.isArray((raw as any).organizations)) {
      return (raw as any).organizations as AuthOrg[];
    }
    return [];
  }, [orgsQuery.data]);

  // Determine active organization
  const currentOrg = useMemo(() => {
    if (!Array.isArray(orgs) || orgs.length === 0) return null;
    if (storedOrgId) {
      const found = orgs.find((o) => o?.id === storedOrgId);
      if (found) return found;
    }
    return orgs[0] ?? null;
  }, [orgs, storedOrgId]);

  const currentOrgId = currentOrg?.id ?? null;

  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    const userObj = newUser && typeof newUser === "object" && "user" in (newUser as any) && (newUser as any).user
      ? (newUser as any).user
      : newUser;
    writeStorage(KEYS.token, newToken);
    writeStorage(KEYS.user, JSON.stringify(userObj));
    emit();
    queryClient.invalidateQueries();
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetchApi("/api/v1/auth/sign-out", { method: "POST" });
      }
    } catch {
      // ignore
    } finally {
      writeStorage(KEYS.token, null);
      writeStorage(KEYS.user, null);
      writeStorage(KEYS.orgId, null);
      writeStorage(KEYS.projectId, null);
      emit();
      queryClient.clear();
      router.push("/sign-in");
    }
  }, [token, queryClient, router]);

  // Connect API 401 callback to clean logout
  useEffect(() => {
    setUnauthorizedHandler(() => {
      writeStorage(KEYS.token, null);
      writeStorage(KEYS.user, null);
      writeStorage(KEYS.orgId, null);
      writeStorage(KEYS.projectId, null);
      emit();
      queryClient.clear();
      router.push("/sign-in");
    });
  }, [queryClient, router]);

  const switchOrg = useCallback((orgId: string) => {
    writeStorage(KEYS.orgId, orgId);
    writeStorage(KEYS.projectId, null);
    emit();
    queryClient.invalidateQueries();
  }, [queryClient]);

  const switchProject = useCallback((projectId: string | null) => {
    writeStorage(KEYS.projectId, projectId);
    emit();
  }, []);

  const refreshUserData = useCallback(async () => {
    await Promise.all([
      userQuery.refetch(),
      orgsQuery.refetch(),
    ]);
  }, [userQuery, orgsQuery]);

  const setOrgs = useCallback((_newOrgs?: any) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.users.organizations() });
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(
    () => ({
      isReady,
      isAuthenticated: Boolean(token),
      isLoading: Boolean(token) && (userQuery.isLoading || orgsQuery.isLoading),
      token,
      user,
      orgs,
      currentOrg,
      currentOrgId,
      currentProjectId: storedProjectId,
      setSession,
      logout,
      switchOrg,
      switchProject,
      refreshUserData,
      setOrgs,
    }),
    [
      isReady,
      token,
      userQuery.isLoading,
      orgsQuery.isLoading,
      user,
      orgs,
      currentOrg,
      currentOrgId,
      storedProjectId,
      setSession,
      logout,
      switchOrg,
      switchProject,
      refreshUserData,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

const defaultSessionValue: SessionContextValue = {
  isReady: false,
  isAuthenticated: false,
  isLoading: false,
  token: null,
  user: null,
  orgs: [],
  currentOrg: null,
  currentOrgId: null,
  currentProjectId: null,
  setSession: () => {},
  logout: async () => {},
  switchOrg: () => {},
  switchProject: () => {},
  refreshUserData: async () => {},
  setOrgs: () => {},
};

export function useAuth(): SessionContextValue {
  const context = useContext(SessionContext);
  return context ?? defaultSessionValue;
}
