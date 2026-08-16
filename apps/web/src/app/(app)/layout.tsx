"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/lib/state";

const NAV = [
  ["Runtime", "/runtime"],
  ["Applications", "/applications"],
  ["Requests", "/requests"],
  ["Topology", "/topology"],
  ["Simulations", "/simulations"],
  ["Change Plans", "/change-plans"],
  ["Cache", "/cache"],
  ["Incidents", "/incidents"],
  ["Policies", "/policies"],
  ["Audit", "/audit"],
  ["AI", "/ai"],
  ["Billing", "/billing"],
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const s = useAppState();
  const ws = s.workspaces;
  const projects = ws.find((w) => w.id === s.workspaceId)?.projects ?? [];
  const apps = projects.find((p) => p.id === s.projectId)?.applications ?? [];
  const envs = apps.find((a) => a.id === s.applicationId)?.environments ?? [];

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">STRIM</div>
        <nav className="nav">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} className={path === href ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="main">
        <div className="top">
          <select value={s.orgId ?? ""} onChange={(e) => s.setOrgId(e.target.value)}>
            {s.orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <select value={s.workspaceId ?? ""} onChange={(e) => s.setWorkspaceId(e.target.value)}>
            {ws.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select value={s.projectId ?? ""} onChange={(e) => s.setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={s.applicationId ?? ""} onChange={(e) => s.setApplicationId(e.target.value)}>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select value={s.environmentId ?? ""} onChange={(e) => s.setEnvironmentId(e.target.value)}>
            {envs.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        {children}
      </section>
    </div>
  );
}
