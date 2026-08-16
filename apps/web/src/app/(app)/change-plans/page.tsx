"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Plan = {
  id: string;
  title: string;
  state: string;
  riskLevel?: string;
  rolloutPercent: number;
};

export default function ChangePlansPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["change-plans", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ changePlans: Plan[] }>(`/v1/change-plans?environmentId=${environmentId ?? ""}`, { token, orgId }),
  });
  const create = useMutation({
    mutationFn: () =>
      api("/v1/change-plans", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          title: "Enable checkout cache",
          description: "Turn on cache and drop timeout",
          objective: "Improve P95",
          proposed: { "cache.enabled": true, "cache.ttl": 60, "checkout.timeout": 3000 },
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-plans"] }),
  });
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api(`/v1/change-plans/${id}/${action}`, { method: "POST", token, orgId, body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["change-plans"] }),
  });
  const rows = q.data?.changePlans ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Change Plans</h1>
        <Button onClick={() => create.mutate()} disabled={!environmentId || create.isPending}>
          New plan
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Rollout</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.state}</Badge>
                  </TableCell>
                  <TableCell>{p.riskLevel ?? "—"}</TableCell>
                  <TableCell>{p.rolloutPercent}%</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => act.mutate({ id: p.id, action: "simulate" })}>
                      Simulate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act.mutate({ id: p.id, action: "approve" })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act.mutate({ id: p.id, action: "rollout" })}>
                      Rollout
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => act.mutate({ id: p.id, action: "rollback" })}>
                      Rollback
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
