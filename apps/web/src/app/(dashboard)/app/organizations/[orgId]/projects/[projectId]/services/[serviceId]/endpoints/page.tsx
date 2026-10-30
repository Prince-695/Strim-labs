"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Compass,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Zap,
  Shield,
  AlertTriangle,
  Loader2,
  FileCode,
  Tag,
  ArrowLeft,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HttpMethodBadge } from "@/components/data-display/http-method-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string; serviceId: string }>;
}

const createEndpointSchema = z.object({
  path: z.string().min(1, "Path is required").startsWith("/", "Must start with a slash (e.g. /api/users)"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
  summary: z.string().max(128).optional(),
  description: z.string().max(256).optional(),
});

type CreateEndpointForm = z.infer<typeof createEndpointSchema>;

const HTTP_METHODS = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export default function EndpointsCatalogPage({ params }: PageProps) {
  const { orgId, projectId, serviceId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Endpoints
  const {
    data: endpointsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.services.endpoints(orgId, projectId, serviceId),
    queryFn: () =>
      fetchApi<{ endpoints: Schemas["Endpoint"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints`
      ).then((res) => res.endpoints),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<CreateEndpointForm>({
    resolver: zodResolver(createEndpointSchema),
    defaultValues: {
      path: "/",
      method: "GET",
      summary: "",
      description: "",
    },
  });

  // Create Endpoint Mutation
  const createMutation = useMutation({
    mutationFn: async (values: CreateEndpointForm) => {
      const res = await fetchApi<{ endpoint: Schemas["Endpoint"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints`,
        {
          method: "POST",
          body: JSON.stringify(values),
        }
      );
      return res.endpoint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.endpoints(orgId, projectId, serviceId),
      });
      setCreateModalOpen(false);
      reset();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to register endpoint");
    },
  });

  const endpoints = endpointsData || [];

  // Filtered endpoints
  const filtered = useMemo(() => {
    return endpoints.filter((ep) => {
      const matchesSearch =
        ep.path.toLowerCase().includes(search.toLowerCase()) ||
        (ep.summary && ep.summary.toLowerCase().includes(search.toLowerCase()));
      const matchesMethod = selectedMethod === "ALL" || ep.method === selectedMethod;
      return matchesSearch && matchesMethod;
    });
  }, [endpoints, search, selectedMethod]);

  if (isLoading) return <LoadingState message="Loading endpoint catalog..." />;

  if (error) {
    return (
      <ErrorState
        title="Failed to load endpoints"
        description={(error as any)?.message || "Could not retrieve endpoints."}
        onRetry={refetch}
      />
    );
  }

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
        title="API Endpoints"
        description="Exploration, parameter schema validation, and targeted benchmark configurations."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  `/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}/discovery`
                )
              }
              className="gap-1.5"
            >
              <Compass className="size-4" />
              <span>Discovery Runs</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setActionError(null);
                setCreateModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              <span>Add Endpoint</span>
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search route path or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8 text-xs"
            />
          </div>

          {/* HTTP Method Filters */}
          <div className="flex items-center gap-1">
            {HTTP_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                  selectedMethod === m
                    ? "bg-brand text-brand-foreground"
                    : "bg-surface-muted/60 text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-muted-foreground">
          Showing {filtered.length} of {endpoints.length} routes
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No endpoints matching query"
          description={
            endpoints.length === 0
              ? "Discover endpoints via automated crawling or import an OpenAPI spec."
              : "Try adjusting your search criteria or method filter."
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Method</TH>
                <TH>Path</TH>
                <TH>Summary</TH>
                <TH>Source</TH>
                <TH>Safety SLA</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((ep) => (
                <TR key={ep.id}>
                  <TD>
                    <HttpMethodBadge method={ep.method} />
                  </TD>
                  <TD className="text-xs font-mono font-semibold text-foreground">
                    {ep.path}
                  </TD>
                  <TD className="text-xs text-muted-foreground truncate max-w-sm">
                    {ep.summary || ep.description || "—"}
                  </TD>
                  <TD>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {ep.source}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge
                      variant={ep.isSafe ? "default" : "secondary"}
                      className="font-mono text-[10px]"
                    >
                      {ep.isSafe ? "SAFE / IDEMPOTENT" : "MUTATION"}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                        onClick={() =>
                          router.push(
                            `/app/organizations/${orgId}/projects/${projectId}/load-tests/new?serviceId=${serviceId}&endpointId=${ep.id}`
                          )
                        }
                      >
                        <Zap className="size-3 mr-1" /> Benchmark
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-brand hover:text-brand"
                        onClick={() =>
                          router.push(
                            `/app/organizations/${orgId}/projects/${projectId}/services/${serviceId}/endpoints/${ep.id}`
                          )
                        }
                      >
                        <span>Details</span>
                        <ArrowRight className="size-3 ml-1" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* Add Manual Endpoint Dialog */}
      <Dialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="Register API Endpoint"
        description="Add a manual route definition to include in testing scenarios."
      >
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="space-y-4 py-2"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5 col-span-1">
              <label className="text-xs font-medium text-foreground">Method *</label>
              <select
                {...register("method")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-foreground">Route Path *</label>
              <Input
                {...register("path")}
                placeholder="/api/v1/checkout"
                className="text-xs font-mono"
                autoFocus
              />
              {formErrors.path && (
                <p className="text-[11px] text-destructive">{formErrors.path.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Summary</label>
            <Input
              {...register("summary")}
              placeholder="e.g. Authorize payments order"
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description</label>
            <Textarea
              {...register("description")}
              placeholder="Full documentation for query parameters and schema..."
              className="text-xs min-h-[60px]"
            />
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
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  <span>Register Route</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
