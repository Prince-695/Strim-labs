"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  KeyRound,
  Users,
  Building,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  Settings,
} from "lucide-react";

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  memberships: Array<{ id: string; role: string; user: { id: string; name: string; email: string } }>;
  apiKeys: Array<{ id: string; name: string; prefix: string; createdAt: string }>;
  _count: { projects: number; testRuns: number };
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const { token, orgId } = useSession();

  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const orgQuery = useQuery({
    queryKey: ["org-settings", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () => api<{ org: OrgDetail }>("/v1/org", { token, orgId }),
  });

  const org = orgQuery.data?.org;

  const createKeyMutation = useMutation({
    mutationFn: () =>
      api<{ rawKey: string }>("/v1/org/api-keys", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({ name: newKeyName || "CI/CD Pipeline" }),
      }),
    onSuccess: (data) => {
      setCreatedKey(data.rawKey);
      setNewKeyName("");
      qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/v1/org/api-keys/${id}`, {
        method: "DELETE",
        token,
        orgId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
            <Settings className="size-4" />
          </div>
          <h1 className="text-xl font-heading font-bold tracking-tight text-foreground">
            Workspace Profile & API Keys
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Manage workspace profile, members, and secure automation keys for CI/CD gates.
        </p>
      </div>

      {/* Organization Info */}
      <Card className="border-border/60 shadow-sm bg-card">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
            <Building className="size-4 text-brand" />
            Workspace Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Organization Name
              </span>
              <span className="text-sm font-bold text-foreground mt-0.5 block">
                {org?.name ?? "STRIM Team"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                Workspace Slug
              </span>
              <span className="font-mono text-muted-foreground text-xs mt-0.5 block">
                {org?.slug ?? "strim"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys for CI/CD */}
      <Card className="border-border/60 shadow-sm bg-card">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
            <KeyRound className="size-4 text-brand" />
            CI/CD & CLI Access Keys
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Trigger automated load tests and breaking point gates directly from GitHub Actions, GitLab CI, or terminal scripts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Create Key Form */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key label (e.g. GitHub Actions Gate)"
              className="h-8 text-xs rounded-lg bg-secondary/50 border-border/60 max-w-md"
            />
            <Button
              onClick={() => createKeyMutation.mutate()}
              disabled={createKeyMutation.isPending}
              className="rounded-lg bg-brand hover:bg-brand-strong text-white font-medium text-xs h-8 px-3.5 gap-1.5 shrink-0"
            >
              <Plus className="size-3.5" />
              Generate API Key
            </Button>
          </div>

          {/* Newly Created Key Alert */}
          {createdKey && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                API Key Generated Successfully
              </span>
              <p className="text-[11px] text-muted-foreground">
                Copy this key now. For security purposes, it will never be displayed in plain text again.
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono font-bold bg-background p-2 rounded-md border border-border/60 flex-1 truncate">
                  {createdKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-md h-8 px-3 gap-1.5 text-xs"
                  onClick={() => handleCopy(createdKey)}
                >
                  {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          {/* Keys List */}
          <div className="space-y-2 pt-1">
            {org?.apiKeys?.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No API keys generated yet.</span>
            ) : (
              org?.apiKeys?.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/60 text-xs"
                >
                  <div>
                    <span className="font-semibold text-foreground block">{k.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {k.prefix}_••••••••••••••••
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-md text-muted-foreground hover:text-destructive"
                    onClick={() => deleteKeyMutation.mutate(k.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card className="border-border/60 shadow-sm bg-card overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
            <Users className="size-4 text-brand" />
            Workspace Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {org?.memberships?.map((m) => (
              <div key={m.id} className="p-3.5 sm:p-4 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-foreground block">{m.user.name}</span>
                  <span className="text-[11px] text-muted-foreground">{m.user.email}</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-semibold py-0.5 px-2 rounded-full border-border/60"
                >
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
