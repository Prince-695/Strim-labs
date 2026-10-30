"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Compass,
  FileCode,
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string; serviceId: string }>;
}

const importSpecSchema = z.object({
  format: z.enum(["OPENAPI_3_0", "OPENAPI_3_1", "SWAGGER_2_0"]),
  specUrl: z.string().url().optional().or(z.literal("")),
  rawSpec: z.string().optional(),
});

type ImportSpecForm = z.infer<typeof importSpecSchema>;

export default function ServiceDiscoveryPage({ params }: PageProps) {
  const { orgId, projectId, serviceId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Discovery Runs
  const {
    data: discoveryRunsData,
    isLoading: runsLoading,
    error: runsError,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: queryKeys.services.discoveryRuns(orgId, projectId, serviceId),
    queryFn: () =>
      fetchApi<{ runs: Schemas["DiscoveryRun"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/discovery-runs`
      ).then((res) => res.runs),
  });

  // Fetch Specifications
  const {
    data: specsData,
    isLoading: specsLoading,
  } = useQuery({
    queryKey: [...queryKeys.services.detail(orgId, projectId, serviceId), "specifications"],
    queryFn: () =>
      fetchApi<{ specifications: Schemas["Specification"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/specifications`
      ).then((res) => res.specifications),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting: isImporting },
  } = useForm<ImportSpecForm>({
    resolver: zodResolver(importSpecSchema),
    defaultValues: {
      format: "OPENAPI_3_1",
      specUrl: "",
      rawSpec: "",
    },
  });

  // Trigger Discovery Run Mutation
  const triggerDiscoveryMutation = useMutation({
    mutationFn: async () => {
      return fetchApi<{ run: Schemas["DiscoveryRun"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/discovery-runs`,
        {
          method: "POST",
          body: JSON.stringify({ source: "crawler" }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.discoveryRuns(orgId, projectId, serviceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.endpoints(orgId, projectId, serviceId),
      });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to initiate discovery crawl");
    },
  });

  // Import OpenAPI Spec Mutation
  const importSpecMutation = useMutation({
    mutationFn: async (values: ImportSpecForm) => {
      let parsedRaw: any = undefined;
      if (values.rawSpec?.trim()) {
        try {
          parsedRaw = JSON.parse(values.rawSpec.trim());
        } catch {
          throw new Error("Raw specification must be valid JSON");
        }
      }

      return fetchApi<{ specification: Schemas["Specification"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/specifications`,
        {
          method: "POST",
          body: JSON.stringify({
            format: values.format,
            specUrl: values.specUrl?.trim() || undefined,
            rawSpec: parsedRaw,
          }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.services.detail(orgId, projectId, serviceId), "specifications"],
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.endpoints(orgId, projectId, serviceId),
      });
      setImportModalOpen(false);
      reset();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to import specification");
    },
  });

  if (runsLoading || specsLoading) {
    return <LoadingState message="Loading discovery runs & OpenAPI specifications..." />;
  }

  const runs = discoveryRunsData || [];
  const specs = specsData || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(`/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}`)
          }
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Service</span>
        </Button>
      </div>

      <PageHeader
        title="API Discovery &amp; Specifications"
        description="Automated route crawling, schema introspection, and OpenAPI 3.0/3.1 contract synchronization."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActionError(null);
                setImportModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Upload className="size-4" />
              <span>Import OpenAPI</span>
            </Button>
            <Button
              size="sm"
              disabled={triggerDiscoveryMutation.isPending}
              onClick={() => triggerDiscoveryMutation.mutate()}
              className="gap-1.5"
            >
              {triggerDiscoveryMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              <span>Start Discovery Run</span>
            </Button>
          </div>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Specifications Catalog */}
      {specs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileCode className="size-4 text-brand" />
            <span>Active OpenAPI Specifications</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {specs.map((spec) => (
              <div
                key={spec.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/50 p-3"
              >
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {spec.title || "OpenAPI Contract"}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    Format: {spec.format} • Version: {spec.version || "1.0.0"}
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {new Date(spec.createdAt).toLocaleDateString()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovery Runs Table */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Discovery History</h3>

        {runs.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No discovery runs executed"
            description="Trigger an automated crawl or import an OpenAPI specification to index endpoints."
            action={{
              label: "Run Discovery",
              onClick: () => triggerDiscoveryMutation.mutate(),
            }}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Status</TH>
                  <TH>Discovery Source</TH>
                  <TH>Endpoints Found</TH>
                  <TH>Started</TH>
                  <TH>Completed</TH>
                  <TH>Diagnostics</TH>
                </TR>
              </THead>
              <TBody>
                {runs.map((run) => (
                  <TR key={run.id}>
                    <TD>
                      <Badge
                        variant={
                          run.status === "COMPLETED"
                            ? "default"
                            : run.status === "RUNNING"
                            ? "secondary"
                            : "destructive"
                        }
                        className="font-mono text-[10px]"
                      >
                        {run.status}
                      </Badge>
                    </TD>
                    <TD className="text-xs font-mono text-foreground uppercase">
                      {run.source}
                    </TD>
                    <TD className="text-xs font-mono font-semibold text-foreground">
                      {run.endpointsFound} routes
                    </TD>
                    <TD className="text-xs font-mono text-muted-foreground">
                      {new Date(run.startedAt).toLocaleTimeString()}
                    </TD>
                    <TD className="text-xs font-mono text-muted-foreground">
                      {run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : "—"}
                    </TD>
                    <TD className="text-xs font-mono text-muted-foreground max-w-xs truncate">
                      {run.error ? (
                        <span className="text-destructive">{run.error}</span>
                      ) : (
                        <span className="text-emerald-400">Success</span>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </div>

      {/* Import OpenAPI Modal */}
      <Dialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Import OpenAPI / Swagger Spec"
        description="Provide a public URL (e.g. /api/v1/openapi.json) or paste raw specification JSON."
      >
        <form onSubmit={handleSubmit((values) => importSpecMutation.mutate(values))} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Specification Format</label>
            <select
              {...register("format")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
            >
              <option value="OPENAPI_3_1">OpenAPI 3.1.x</option>
              <option value="OPENAPI_3_0">OpenAPI 3.0.x</option>
              <option value="SWAGGER_2_0">Swagger 2.0</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Specification URL (HTTPS)</label>
            <Input
              {...register("specUrl")}
              placeholder="https://api.yourdomain.com/openapi.json"
              className="text-xs font-mono"
            />
            {formErrors.specUrl && (
              <p className="text-[11px] text-destructive">{formErrors.specUrl.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Or Paste Raw JSON Spec</label>
            <Textarea
              {...register("rawSpec")}
              placeholder='{ "openapi": "3.1.0", "info": { ... }, "paths": { ... } }'
              className="text-xs font-mono min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isImporting || importSpecMutation.isPending}
              className="gap-1.5"
            >
              {importSpecMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span>Import Specification</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
