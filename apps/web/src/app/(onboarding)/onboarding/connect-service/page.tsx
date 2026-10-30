"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Server, ArrowRight, Loader2, CheckCircle2, Globe, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { fetchApi, type Schemas } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const createServiceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  baseUrl: z.string().url("Must be a valid HTTP or HTTPS URL"),
  framework: z.string().optional(),
  language: z.string().optional(),
  environment: z.enum(["production", "staging", "development"]),
});

type CreateServiceValues = z.infer<typeof createServiceSchema>;

function ConnectServiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const { currentOrgId } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ status: string; latencyMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateServiceValues>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      name: "API Gateway",
      baseUrl: "https://httpbin.org",
      framework: "hono",
      language: "typescript",
      environment: "production",
    },
  });

  const handleTestConnection = async () => {
    const url = getValues("baseUrl");
    if (!url || !url.startsWith("http")) {
      setServerError("Please enter a valid base URL first.");
      return;
    }

    setServerError(null);
    setVerifying(true);
    setVerifyResult(null);

    const start = Date.now();
    try {
      await fetch(url, { method: "HEAD", mode: "no-cors" });
      const latencyMs = Date.now() - start;
      setVerifyResult({ status: "reachable", latencyMs: Math.max(12, latencyMs) });
    } catch {
      setVerifyResult({ status: "offline", latencyMs: 0 });
    } finally {
      setVerifying(false);
    }
  };

  const onSubmit = async (values: CreateServiceValues) => {
    if (!currentOrgId || !projectId) {
      setServerError("Organization or project is missing from context.");
      return;
    }

    setServerError(null);
    try {
      await fetchApi<Schemas["Service"]>(
        `/api/v1/organizations/${currentOrgId}/projects/${projectId}/services`,
        {
          method: "POST",
          body: JSON.stringify(values),
        }
      );

      router.push(`/app/organizations/${currentOrgId}/projects/${projectId}`);
    } catch (err: any) {
      setServerError(err.message || "Failed to register service.");
    }
  };

  const handleSkip = () => {
    if (currentOrgId && projectId) {
      router.push(`/app/organizations/${currentOrgId}/projects/${projectId}`);
    } else {
      router.push("/app");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6">
      {/* Stepper Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-4 border-b border-border">
        <span className="text-emerald-500 flex items-center gap-1">
          <CheckCircle2 className="size-4" /> 1. Organization
        </span>
        <span className="text-muted-foreground/50">&rarr;</span>
        <span className="text-emerald-500 flex items-center gap-1">
          <CheckCircle2 className="size-4" /> 2. Project
        </span>
        <span className="text-muted-foreground/50">&rarr;</span>
        <span className="text-brand flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground text-[10px]">
            3
          </span>
          Connect Service
        </span>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Register your first API Service</h2>
        <p className="text-xs text-muted-foreground">
          Connect your backend base URL to enable automatic route discovery, continuous monitoring, and load test targeting.
        </p>
      </div>

      {serverError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 leading-relaxed">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Service Name</Label>
          <div className="relative">
            <Input
              id="name"
              placeholder="e.g. Payments Microservice"
              disabled={isSubmitting}
              {...register("name")}
              className={errors.name ? "border-rose-500 pl-8" : "pl-8"}
            />
            <Server className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          </div>
          {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="baseUrl">Service Base URL</Label>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={verifying}
              className="text-xs text-brand hover:underline inline-flex items-center gap-1"
            >
              {verifying ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Testing...
                </>
              ) : (
                <>
                  <Radio className="size-3" /> Test Connectivity
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <Input
              id="baseUrl"
              type="url"
              placeholder="https://api.acme.com"
              disabled={isSubmitting}
              {...register("baseUrl")}
              className={errors.baseUrl ? "border-rose-500 pl-8" : "pl-8"}
            />
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          </div>
          {errors.baseUrl && <p className="text-xs text-rose-500">{errors.baseUrl.message}</p>}

          {verifyResult && (
            <div
              className={`rounded-md p-2 text-xs flex items-center justify-between ${
                verifyResult.status === "reachable"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}
            >
              <span>
                {verifyResult.status === "reachable"
                  ? "✓ Target responds to connectivity checks"
                  : "⚠ Host unreachable or blocking CORS/HEAD requests"}
              </span>
              {verifyResult.latencyMs > 0 && (
                <span className="font-mono font-semibold">{verifyResult.latencyMs}ms</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="framework">Framework</Label>
            <Input
              id="framework"
              placeholder="hono, express, fastify..."
              disabled={isSubmitting}
              {...register("framework")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="environment">Environment</Label>
            <select
              id="environment"
              disabled={isSubmitting}
              {...register("environment")}
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="w-1/3 text-xs text-muted-foreground"
          >
            Skip for now
          </Button>

          <Button
            type="submit"
            className="w-2/3 bg-brand text-brand-foreground hover:bg-brand-strong font-medium"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                Complete Setup
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ConnectServicePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted-foreground">Loading service setup...</div>}>
      <ConnectServiceForm />
    </Suspense>
  );
}
