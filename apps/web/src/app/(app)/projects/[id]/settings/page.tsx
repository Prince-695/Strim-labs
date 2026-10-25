"use client";

import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDeleteProject, useRegenerateApiKey } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export default function ProjectSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params?.id;
  const { projects, refreshProjects } = useSession();

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const regen = useRegenerateApiKey();
  const deleteProject = useDeleteProject();

  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const apiKey = project?.apiKey || "";

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopiedKey(false), 2000);
  }

  async function handleRegenerateKey() {
    if (!projectId) return;
    if (!window.confirm("Are you sure? Any servers using the existing API key will immediately fail to ingest telemetry.")) {
      return;
    }

    try {
      await regen.mutateAsync(projectId);
      await refreshProjects();
      toast.success("New Project API Key generated!");
    } catch {
      toast.error("Failed to regenerate API key.");
    }
  }

  async function handleDelete() {
    if (!projectId) return;
    try {
      await deleteProject.mutateAsync(projectId);
      toast.success("Project deleted successfully");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete project.");
    }
  }

  if (!project) {
    return <div className="p-8 text-sm text-muted-foreground">Project not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Project API Key Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="size-4 text-brand" />
            <CardTitle>Project Ingestion API Key</CardTitle>
          </div>
          <CardDescription>
            This secret key authenticates incoming telemetry batches sent by @strim/sdk from your server. Keep this token private.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/60 p-3">
            <code className="flex-1 font-mono text-xs">
              {showKey ? apiKey : `${apiKey.slice(0, 16)}••••••••••••••••••••••••••••`}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKey((v) => !v)}
              className="h-8 px-2 text-xs"
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyKey}
              className="h-8 gap-1.5 text-xs"
            >
              {copiedKey ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copiedKey ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Pass this key into <code className="font-mono">strimExpress</code>, <code className="font-mono">strimHono</code>, etc.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateKey}
              loading={regen.isPending}
              className="gap-1.5 text-xs text-warning hover:text-warning"
            >
              <RefreshCw className="size-3" /> Regenerate Key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-brand" />
            <CardTitle>Project Configuration</CardTitle>
          </div>
          <CardDescription>General metadata and endpoint location.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field id="settings-name" label="Project Name">
            <Input id="settings-name" value={project.name} readOnly className="bg-surface-muted/40" />
          </Field>
          <Field id="settings-url" label="Base URL / Target URL">
            <Input id="settings-url" value={project.baseUrl || project.targetUrl} readOnly className="font-mono text-xs bg-surface-muted/40" />
          </Field>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-rose-500/30">
        <CardHeader>
          <div className="flex items-center gap-2 text-rose-500">
            <AlertTriangle className="size-4" />
            <CardTitle className="text-rose-500">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Permanently remove this project, all auto-discovered routes, and historical benchmark logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!confirmDelete ? (
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 text-xs"
            >
              <Trash2 className="size-3.5" /> Delete this project
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/5 p-4">
              <p className="text-xs font-semibold text-rose-500">
                Are you absolutely sure? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDelete}
                  loading={deleteProject.isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
                >
                  Yes, delete project
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
