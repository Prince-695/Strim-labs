"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Rule = { id: string; endpoint: string; method: string; ttlSeconds: number; enabled: boolean };
type Rec = { endpoint: string; method: string; reason: string; projectedOriginReductionPct: number };

export default function CachePage() {
  const { token, orgId, environmentId } = useSession();
  const qc = useQueryClient();
  const rules = useQuery({
    queryKey: ["cache-rules", orgId, environmentId],
    enabled: Boolean(token && orgId),
    queryFn: () =>
      api<{ rules: Rule[] }>(`/v1/cache/rules?environmentId=${environmentId ?? ""}`, { token, orgId }),
  });
  const recs = useQuery({
    queryKey: ["cache-recs", orgId, environmentId],
    enabled: Boolean(token && orgId && environmentId),
    queryFn: () =>
      api<{ recommendations: Rec[] }>(`/v1/cache/recommendations?environmentId=${environmentId}`, {
        token,
        orgId,
      }),
  });
  const create = useMutation({
    mutationFn: () =>
      api("/v1/cache/rules", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          environmentId,
          endpoint: "/products",
          method: "GET",
          ttlSeconds: 60,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cache-rules"] }),
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cache</h1>
        <Button onClick={() => create.mutate()} disabled={!environmentId}>
          Cache GET /products
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>TTL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rules.data?.rules ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.endpoint}</TableCell>
                  <TableCell>{r.method}</TableCell>
                  <TableCell>{r.ttlSeconds}s</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(recs.data?.recommendations ?? []).map((r) => (
            <p key={r.endpoint}>
              {r.method} {r.endpoint} — {r.reason} ({r.projectedOriginReductionPct}% origin reduction)
            </p>
          ))}
          {(recs.data?.recommendations.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No candidates yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
