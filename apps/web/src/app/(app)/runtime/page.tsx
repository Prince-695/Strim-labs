"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const { token, orgId, environmentId } = useSession();
  const q = useQuery({
    queryKey: ["runtime", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<Overview>(`/v1/runtime/overview?environmentId=${environmentId}`, { token, orgId }),
  });

  if (!environmentId) return <p className="text-muted-foreground">Select an environment.</p>;
  if (q.isError) return <p className="text-destructive">{(q.error as Error).message}</p>;
  if (!q.data) return <p className="text-muted-foreground">Loading runtime…</p>;

  const d = q.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Runtime</h1>
        <p className="text-muted-foreground">
          {d.application} / {d.environment} · version {d.currentVersion?.seq ?? "—"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Health score" value={String(d.health.score)} hint="Always shown with breakdown" />
        <Metric title="RPS" value={String(d.traffic.rps)} />
        <Metric title="P95 / P99" value={`${Math.round(d.latency.p95)} / ${Math.round(d.latency.p99)}`} />
        <Metric title="Error rate" value={`${(d.errorRate * 100).toFixed(2)}%`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Health breakdown</CardTitle>
          <CardDescription>Never a bare number — FR-9.1.2</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {Object.entries(d.health.breakdown).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="capitalize text-muted-foreground">{k}</span>
              <Badge variant="secondary">{v}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {d.activeIncidents.length === 0 ? (
            <p className="text-muted-foreground">None</p>
          ) : (
            <ul className="space-y-1">
              {d.activeIncidents.map((i) => (
                <li key={i.id}>{i.title}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}
