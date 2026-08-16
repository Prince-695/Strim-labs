"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Simulation = {
  id: string;
  status: string;
  comparison?: { metric: string; deltaPct: number }[];
  createdAt: string;
};

export default function SimulationsPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["simulations", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ simulations: Simulation[] }>(`/v1/simulations?environmentId=${environmentId ?? ""}`, {
        token,
        orgId,
      }),
  });
  const run = useMutation({
    mutationFn: () =>
      api("/v1/simulations", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          change: { kind: "cache", enabled: true },
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["simulations"] }),
  });
  const rows = q.data?.simulations ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Simulations</h1>
        <Button onClick={() => run.mutate()} disabled={!environmentId || run.isPending}>
          Run cache what-if
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Baseline vs experiment</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge>{s.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(s.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
