"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, Plus, Trash2, Copy, Check, ShieldAlert } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
  lastUsedAt?: string | null;
};

export default function KeysPage() {
  const { token, orgId } = useSession();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ name: string; rawKey: string } | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("ingest");
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["api-keys", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () => api<{ keys: ApiKey[] }>("/v1/api-keys", { token, orgId }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api<{ key: ApiKey; rawKey: string }>("/v1/api-keys", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({ name, role }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey({ name: data.key.name, rawKey: data.rawKey });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/v1/api-keys/${id}`, {
        method: "DELETE",
        token,
        orgId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const rows = q.data?.keys ?? [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage authentication credentials for telemetry ingestion, CI/CD gates, and SDK runtime synchronization.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="cursor-pointer gap-2">
          <Plus className="size-4" />
          Generate API Key
        </Button>
      </div>

      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle>Active Organization Credentials</CardTitle>
          <CardDescription>
            Scoped keys with role-based access control (Admin, Ingest, Read-only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((k) => (
                <TableRow key={k.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <KeyRound className="size-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{k.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={k.role === "admin" ? "default" : "secondary"} className="uppercase text-[10px]">
                      {k.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revokeMutation.mutate(k.id)}
                      disabled={revokeMutation.isPending}
                      className="size-8 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Revoke Key"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No active API keys found. Click &quot;Generate API Key&quot; to create one.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreatedKey(null);
            setName("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          {!createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Generate API Key</DialogTitle>
                <DialogDescription>
                  Create a new credential to authenticate SDK clients or CI/CD pipelines.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g. production-ingest-key"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="keyRole">Access Role</Label>
                  <select
                    id="keyRole"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="ingest">Ingest (Telemetry and SDK runtime sync)</option>
                    <option value="read">Read Only (Telemetry query and dashboards)</option>
                    <option value="admin">Admin (Full administrative CRUD)</option>
                  </select>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setCreateOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!name.trim() || createMutation.isPending}
                  className="cursor-pointer"
                >
                  {createMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Save Your API Key</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5 text-amber-500">
                  <ShieldAlert className="size-4 shrink-0" />
                  This key will never be shown again. Copy and store it securely.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">{createdKey.name}</Label>
                <div className="relative rounded-md bg-muted p-3 font-mono text-xs text-foreground flex items-center justify-between">
                  <span className="truncate mr-2">{createdKey.rawKey}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="size-7 p-0 shrink-0 cursor-pointer"
                    onClick={() => copyToClipboard(createdKey.rawKey)}
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button onClick={() => setCreateOpen(false)} className="cursor-pointer">
                  I have saved this key
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
