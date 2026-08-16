"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Log = {
  id: string;
  action: string;
  resourceType: string;
  actorType: string;
  createdAt: string;
};

export default function AuditPage() {
  const { token, orgId } = useSession();
  const q = useQuery({
    queryKey: ["audit", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () => api<{ logs: Log[] }>("/v1/audit", { token, orgId }),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
      <Card>
        <CardHeader>
          <CardTitle>Immutable log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.logs ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{new Date(l.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{l.action}</TableCell>
                  <TableCell>{l.resourceType}</TableCell>
                  <TableCell>{l.actorType}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
