"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Key,
  Plus,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  Shield,
  Clock,
  Loader2,
  Lock,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CopyButton } from "@/components/data-display/copy-button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

const AVAILABLE_SCOPES = [
  { id: "read:all", label: "Read All", desc: "Read telemetry, endpoints, and dashboards" },
  { id: "telemetry:write", label: "Telemetry Ingestion", desc: "Ingest OTel spans and metrics via SDK" },
  { id: "load-test:write", label: "Load Test Execution", desc: "Trigger and abort distributed load tests" },
  { id: "config:write", label: "Config Management", desc: "Create and update services and alerts" },
  { id: "config:read", label: "Config Read", desc: "Read configuration and project schema" },
  { id: "alerts:write", label: "Alerts Management", desc: "Manage alert rules and notification channels" },
] as const;

const createKeySchema = z.object({
  name: z.string().min(2, "Key name must be at least 2 characters").max(64),
  scopes: z.array(z.string()).min(1, "Select at least one scope"),
});

type CreateKeyForm = z.infer<typeof createKeySchema>;

export default function OrganizationApiKeysPage({ params }: PageProps) {
  const { orgId } = use(params);
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch API Keys
  const {
    data: apiKeys,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.organizations.apiKeys(orgId),
    queryFn: () =>
      fetchApi<Schemas["ApiKey"][]>(`/api/v1/organizations/${orgId}/api-keys`),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<CreateKeyForm>({
    resolver: zodResolver(createKeySchema),
    defaultValues: {
      name: "",
      scopes: ["read:all", "telemetry:write"],
    },
  });

  const selectedScopes = watch("scopes");

  const toggleScope = (scopeId: string) => {
    if (selectedScopes.includes(scopeId)) {
      setValue("scopes", selectedScopes.filter((s) => s !== scopeId), { shouldValidate: true });
    } else {
      setValue("scopes", [...selectedScopes, scopeId], { shouldValidate: true });
    }
  };

  // Create Key Mutation
  const createMutation = useMutation({
    mutationFn: async (values: CreateKeyForm) => {
      const res = await fetchApi<Schemas["CreatedApiKey"]>(
        `/api/v1/organizations/${orgId}/api-keys`,
        {
          method: "POST",
          body: JSON.stringify(values),
        }
      );
      return res;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.apiKeys(orgId) });
      setCreateModalOpen(false);
      setCreatedSecretKey(data.key);
      reset();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to create API key");
    },
  });

  // Revoke Key Mutation
  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await fetchApi<{ ok: boolean }>(`/api/v1/organizations/${orgId}/api-keys/${keyId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.apiKeys(orgId) });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to revoke API key");
    },
  });

  if (isLoading) return <LoadingState message="Loading organization API keys..." />;

  if (error) {
    return (
      <ErrorState
        title="Failed to load API keys"
        description={(error as any)?.message || "Could not retrieve access credentials."}
        onRetry={refetch}
      />
    );
  }

  const keys = apiKeys || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Machine credentials for programmatic telemetry ingestion, CI/CD automation, and benchmark runs."
        action={
          <Button
            size="sm"
            onClick={() => {
              setActionError(null);
              setCreateModalOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            <span>Generate Key</span>
          </Button>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* API Keys Table */}
      {keys.length === 0 ? (
        <EmptyState
          icon={Key}
          title="No API keys generated"
          description="Create your first organization API key to configure telemetry ingestion and CI pipelines."
          action={{
            label: "Generate API Key",
            onClick: () => setCreateModalOpen(true),
          }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Key Prefix</TH>
                <TH>Scopes</TH>
                <TH>Created</TH>
                <TH>Last Used</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {keys.map((k) => (
                <TR key={k.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Key className="size-3.5 text-brand shrink-0" />
                      <span className="font-semibold text-xs text-foreground">{k.name}</span>
                    </div>
                  </TD>
                  <TD className="text-xs font-mono text-muted-foreground">
                    {k.prefix}...
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px] font-mono">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TD>
                  <TD className="text-xs text-muted-foreground font-mono">
                    {new Date(k.createdAt).toLocaleDateString()}
                  </TD>
                  <TD className="text-xs text-muted-foreground font-mono">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMutation.mutate(k.id)}
                      disabled={revokeMutation.isPending}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5 mr-1" /> Revoke
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* Create Key Dialog */}
      <Dialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Generate Organization API Key"
        description="Choose a memorable name and grant minimum required permissions."
      >
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Key Name *</label>
            <Input
              {...register("name")}
              placeholder="e.g. GitHub Actions Ingest"
              className="text-xs"
              autoFocus
            />
            {formErrors.name && (
              <p className="text-[11px] text-destructive">{formErrors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Scopes &amp; Permissions *</label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {AVAILABLE_SCOPES.map((scope) => {
                const checked = selectedScopes.includes(scope.id);
                return (
                  <div
                    key={scope.id}
                    onClick={() => toggleScope(scope.id)}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      checked
                        ? "border-brand bg-brand/5"
                        : "border-border hover:bg-surface-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-semibold text-foreground font-mono">
                        {scope.label} <span className="text-[10px] text-muted-foreground font-normal">({scope.id})</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{scope.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {formErrors.scopes && (
              <p className="text-[11px] text-destructive">{formErrors.scopes.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting || createMutation.isPending} className="gap-1.5">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Key className="size-3.5" />
                  <span>Generate Key</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Secret Key One-Time Display Modal */}
      <Dialog
        open={Boolean(createdSecretKey)}
        onOpenChange={() => setCreatedSecretKey(null)}
        title="Save Your API Key"
        description="This key will NEVER be shown again. Store it securely in your secrets manager or CI/CD environment."
      >
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center gap-2">
            <Lock className="size-4 shrink-0 text-amber-400" />
            <span>Ensure you copy this secret now. You will not have access to it after closing this modal.</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted p-2.5">
            <code className="flex-1 font-mono text-xs text-foreground select-all break-all">
              {createdSecretKey}
            </code>
            {createdSecretKey && <CopyButton text={createdSecretKey} />}
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setCreatedSecretKey(null)}>
              I Have Saved This Key
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
