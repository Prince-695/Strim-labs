"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/state";

type Overview = {
  application: string;
  environment: string;
  health: { score: number; breakdown: Record<string, number> };
  traffic: { rps: number };
  latency: { p95: number; p99: number };
  errorRate: number;
  currentVersion: { seq: number } | null;
  activeIncidents: { id: string; title: string }[];
};

export default function RuntimePage() {
  const { token, orgId, environmentId } = useAppState();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !orgId || !environmentId) return;
    api<Overview>(`/v1/runtime/overview?environmentId=${environmentId}`, { token, orgId })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, orgId, environmentId]);

  if (error) return <p>{error}</p>;
  if (!data) return <p className="muted">Select an environment to load runtime data.</p>;

  return (
    <div>
      <h1>Runtime</h1>
      <p className="muted">
        {data.application} / {data.environment} · version {data.currentVersion?.seq ?? "—"}
      </p>
      <div className="grid">
        <div className="card">
          <div className="muted">Health score</div>
          <div className="score">{data.health.score}</div>
        </div>
        <div className="card">
          <div className="muted">RPS</div>
          <div className="score">{data.traffic.rps}</div>
        </div>
        <div className="card">
          <div className="muted">P95 / P99</div>
          <div className="score">
            {Math.round(data.latency.p95)} / {Math.round(data.latency.p99)}
          </div>
        </div>
        <div className="card">
          <div className="muted">Error rate</div>
          <div className="score">{(data.errorRate * 100).toFixed(2)}%</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Health breakdown</h3>
        <table>
          <tbody>
            {Object.entries(data.health.breakdown).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
