"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PoliciesPage() {
  const { token, orgId } = useSession();
  const q = useQuery({
    queryKey: ["policies", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () => api<{ policies: { id: string; name: string; kind: string }[] }>("/v1/policies", { token, orgId }),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
      <Card>
        <CardHeader>
          <CardTitle>Org policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(q.data?.policies ?? []).map((p) => (
            <div key={p.id} className="rounded-md border px-3 py-2">
              {p.name} <span className="text-muted-foreground">({p.kind})</span>
            </div>
          ))}
          {(q.data?.policies.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No policies yet. Create them via the API.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
