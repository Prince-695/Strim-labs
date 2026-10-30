"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Server,
  Globe,
  ArrowLeft,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Code,
  Tag,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

const createServiceSchema = z.object({
  name: z.string().min(2, "Service name must be at least 2 characters").max(64),
  baseUrl: z.string().url("Must be a valid HTTP or HTTPS base URL"),
  environment: z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT"]),
  framework: z.string().max(32).optional(),
  language: z.string().max(32).optional(),
  description: z.string().max(256).optional(),
});

type FormValues = z.infer<typeof createServiceSchema>;

export default function NewServicePage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name: "",
      baseUrl: "",
      environment: "PRODUCTION",
      framework: "Hono / Node.js",
      language: "TypeScript",
      description: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await fetchApi<{ service: Schemas["Service"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services`,
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            baseUrl: values.baseUrl.trim(),
            environment: values.environment,
            framework: values.framework?.trim() || undefined,
            language: values.language?.trim() || undefined,
            description: values.description?.trim() || undefined,
          }),
        }
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.services.all(orgId, projectId) });
      router.push(
        `/app/organizations/${orgId}/projects/${projectId}/services/${res.service.id}/discovery`
      );
    } catch (err: any) {
      setServerError(err.message || "Failed to register service");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </Button>
      </div>

      <PageHeader
        title="Register New Service"
        description="Register a microservice base endpoint for API discovery and load testing."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border border-border bg-card p-6">
        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Service Name *</label>
          <div className="relative">
            <Server className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              {...register("name")}
              placeholder="e.g. Payments Gateway"
              className="pl-9 text-xs"
              autoFocus
            />
          </div>
          {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
        </div>

        {/* Base URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Service Base URL *</label>
          <div className="relative">
            <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              {...register("baseUrl")}
              placeholder="https://api.payments.internal.com"
              className="pl-9 text-xs font-mono"
            />
          </div>
          {errors.baseUrl && <p className="text-[11px] text-destructive">{errors.baseUrl.message}</p>}
        </div>

        {/* Environment & Framework */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Environment</label>
            <select
              {...register("environment")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
            >
              <option value="PRODUCTION">Production</option>
              <option value="STAGING">Staging</option>
              <option value="DEVELOPMENT">Development</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Framework / Runtime</label>
            <Input
              {...register("framework")}
              placeholder="e.g. Hono, FastAPI, Spring"
              className="text-xs"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Description (Optional)</label>
          <Textarea
            {...register("description")}
            placeholder="Core checkout authorization and webhooks service..."
            className="text-xs min-h-[70px]"
          />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Registering Service...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                <span>Register Service</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
