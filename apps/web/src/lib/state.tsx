"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Org = { id: string; name: string; slug: string; role: string };
export type EnvNode = { id: string; name: string; type: string };
export type AppNode = { id: string; name: string; environments: EnvNode[] };
export type ProjectNode = { id: string; name: string; applications: AppNode[] };
export type WorkspaceNode = { id: string; name: string; projects: ProjectNode[] };

type Ctx = {
  token: string | null;
  orgs: Org[];
  orgId: string | null;
  workspaces: WorkspaceNode[];
  workspaceId: string | null;
  projectId: string | null;
  applicationId: string | null;
  environmentId: string | null;
  setToken: (t: string | null, orgs?: Org[]) => void;
  setOrgId: (id: string) => void;
  setWorkspaceId: (id: string) => void;
  setProjectId: (id: string) => void;
  setApplicationId: (id: string) => void;
  setEnvironmentId: (id: string) => void;
};

const C = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceNode[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("strim_token");
    const o = localStorage.getItem("strim_orgs");
    if (t) setTokenState(t);
    if (o) {
      const parsed = JSON.parse(o) as Org[];
      setOrgs(parsed);
      setOrgId(parsed[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    if (!token || !orgId) return;
    void fetch("http://localhost:3001/v1/org/context", {
      headers: { authorization: `Bearer ${token}`, "x-organization-id": orgId },
    })
      .then((r) => r.json())
      .then((d: { workspaces: WorkspaceNode[] }) => {
        setWorkspaces(d.workspaces ?? []);
        const ws = d.workspaces?.[0];
        const proj = ws?.projects?.[0];
        const app = proj?.applications?.[0];
        const env = app?.environments?.find((e) => e.name === "Production") ?? app?.environments?.[0];
        setWorkspaceId(ws?.id ?? null);
        setProjectId(proj?.id ?? null);
        setApplicationId(app?.id ?? null);
        setEnvironmentId(env?.id ?? null);
      })
      .catch(() => undefined);
  }, [token, orgId]);

  const value = useMemo(
    () => ({
      token,
      orgs,
      orgId,
      workspaces,
      workspaceId,
      projectId,
      applicationId,
      environmentId,
      setToken: (t: string | null, nextOrgs?: Org[]) => {
        setTokenState(t);
        if (t) localStorage.setItem("strim_token", t);
        else localStorage.removeItem("strim_token");
        if (nextOrgs) {
          setOrgs(nextOrgs);
          localStorage.setItem("strim_orgs", JSON.stringify(nextOrgs));
          setOrgId(nextOrgs[0]?.id ?? null);
        }
      },
      setOrgId,
      setWorkspaceId,
      setProjectId,
      setApplicationId,
      setEnvironmentId,
    }),
    [token, orgs, orgId, workspaces, workspaceId, projectId, applicationId, environmentId],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useAppState() {
  const v = useContext(C);
  if (!v) throw new Error("AppState missing");
  return v;
}
