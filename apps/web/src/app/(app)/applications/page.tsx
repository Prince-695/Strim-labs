"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Application = {
  id: string;
  name: string;
  language?: string;
  framework?: string;
  region?: string;
  ownerTeam?: { name: string };
  oncallTeam?: { name: string };
  environments: { id: string; name: string; type: string }[];
};

export default function ApplicationsPage() {
  const { token, orgId } = useSession();
  const q = useQuery({
    queryKey: ["applications", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () => api<{ applications: Application[] }>("/v1/org/applications", { token, orgId }),
  });
  const rows = q.data?.applications ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
      <Card>
        <CardHeader>
          <CardTitle>Connected systems</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>On-call</TableHead>
                <TableHead>Environments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.language ?? "—"}</TableCell>
                  <TableCell>{a.ownerTeam?.name ?? "—"}</TableCell>
                  <TableCell>{a.oncallTeam?.name ?? "—"}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {a.environments.map((e) => (
                      <Badge key={e.id} variant="outline">
                        {e.name}
                      </Badge>
                    ))}
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
