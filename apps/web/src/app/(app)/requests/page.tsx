"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type RequestRow = {
  id: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  service?: string;
  traceId: string;
};

export default function RequestsPage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["requests", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ requests: RequestRow[] }>(`/v1/requests?environmentId=${environmentId}`, { token, orgId }),
  });
  const replay = useMutation({
    mutationFn: (id: string) =>
      api("/v1/replay", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          mode: "exact",
          requestIds: [id],
          targetEnvType: "STAGING",
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["requests"] }),
  });
  const rows = q.data?.requests ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
      <Card>
        <CardHeader>
          <CardTitle>Explorer</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Service</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant="outline">{r.method}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.path}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{Math.round(r.durationMs)}ms</TableCell>
                  <TableCell>{r.service ?? "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => replay.mutate(r.id)}>
                      Replay
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 ? <p className="pt-4 text-muted-foreground">No requests yet. Hit the demo checkout app.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
