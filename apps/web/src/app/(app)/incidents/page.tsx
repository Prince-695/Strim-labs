"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Factor = { label: string; confidence: string };
type Incident = {
  id: string;
  title: string;
  severity: string;
  status: string;
  factors: Factor[];
  timeline: { label: string; occurredAt: string }[];
};

export default function IncidentsPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["incidents", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ incidents: Incident[] }>(`/v1/incidents?environmentId=${environmentId ?? ""}`, { token, orgId }),
  });
  const evaluate = useMutation({
    mutationFn: () =>
      api("/v1/incidents/evaluate", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({ environmentId, errorRate: 0.2, p95Ms: 900 }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
        <Button onClick={() => evaluate.mutate()} disabled={!environmentId}>
          Evaluate spike
        </Button>
      </div>
      {(q.data?.incidents ?? []).map((i) => (
        <Card key={i.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {i.title}
              <Badge>{i.status}</Badge>
              <Badge variant="destructive">{i.severity}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">Potential contributing factors (causality is not proven):</p>
            <ul className="list-disc pl-5">
              {i.factors.map((f) => (
                <li key={f.label}>
                  {f.label} — confidence {f.confidence}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      {(q.data?.incidents.length ?? 0) === 0 ? <p className="text-muted-foreground">No incidents.</p> : null}
    </div>
  );
}
