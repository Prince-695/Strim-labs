"use client";

import { use, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Zap,
  ArrowLeft,
  ArrowRight,
  Server,
  Compass,
  Play,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
  Sliders,
  CheckCircle2,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { HttpMethodBadge } from "@/components/data-display/http-method-badge";
import { PageHeader } from "@/components/layout/page-header";

interface PageProps {
  params: Promise<{ orgId: string; projectId: string }>;
}

const createTestSchema = z.object({
  name: z.string().min(2, "Test name is required").max(100),
  description: z.string().max(500).optional(),
  targetUrl: z.string().url("Must be a valid target URL"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
  profile: z.enum(["BREAKING_HUNT", "RAMP_UP", "SUSTAINED", "SPIKE"]),
  concurrency: z.number().int().min(1).max(1000),
  durationSec: z.number().int().min(5).max(300),
  rampUpSec: z.number().int().min(0).max(120),
  payloadJson: z.string().optional(),
});

type FormValues = z.infer<typeof createTestSchema>;

export default function NewLoadTestPage({ params }: PageProps) {
  const { orgId, projectId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const queryServiceId = searchParams.get("serviceId");
  const queryEndpointId = searchParams.get("endpointId");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(queryServiceId || "");
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch Services
  const { data: servicesData } = useQuery({
    queryKey: queryKeys.services.all(orgId, projectId),
    queryFn: () =>
      fetchApi<{ services: Schemas["Service"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services`
      ).then((res) => res.services),
  });

  const services = servicesData || [];

  // Fetch Endpoints if service is selected
  const { data: endpointsData } = useQuery({
    queryKey: queryKeys.services.endpoints(orgId, projectId, selectedServiceId),
    enabled: Boolean(selectedServiceId),
    queryFn: () =>
      fetchApi<{ endpoints: Schemas["Endpoint"][] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/services/${selectedServiceId}/endpoints`
      ).then((res) => res.endpoints),
  });

  const endpoints = endpointsData || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createTestSchema),
    defaultValues: {
      name: "Breaking Point Capacity Hunt",
      description: "Automated saturation knee and latency regression benchmark.",
      targetUrl: "https://httpbin.org/get",
      method: "GET",
      profile: "BREAKING_HUNT",
      concurrency: 50,
      durationSec: 30,
      rampUpSec: 10,
      payloadJson: "",
    },
  });

  const currentProfile = watch("profile");
  const currentMethod = watch("method");
  const currentUrl = watch("targetUrl");
  const currentConcurrency = watch("concurrency");
  const currentDuration = watch("durationSec");

  // Handle service/endpoint preselection
  useEffect(() => {
    if (queryServiceId && services.length > 0) {
      setSelectedServiceId(queryServiceId);
      const svc = services.find((s) => s.id === queryServiceId);
      if (svc) {
        setValue("targetUrl", svc.baseUrl);
      }
    }
  }, [queryServiceId, services, setValue]);

  useEffect(() => {
    if (queryEndpointId && endpoints.length > 0) {
      const ep = endpoints.find((e) => e.id === queryEndpointId);
      const svc = services.find((s) => s.id === selectedServiceId);
      if (ep && svc) {
        const full = `${svc.baseUrl.replace(/\/+$/, "")}${ep.path.startsWith("/") ? "" : "/"}${ep.path}`;
        setValue("targetUrl", full);
        setValue("method", ep.method as any);
        setValue("name", `${ep.method} ${ep.path} Saturation Hunt`);
      }
    }
  }, [queryEndpointId, endpoints, services, selectedServiceId, setValue]);

  const onSelectEndpoint = (endpointId: string) => {
    const ep = endpoints.find((e) => e.id === endpointId);
    const svc = services.find((s) => s.id === selectedServiceId);
    if (ep && svc) {
      const full = `${svc.baseUrl.replace(/\/+$/, "")}${ep.path.startsWith("/") ? "" : "/"}${ep.path}`;
      setValue("targetUrl", full);
      setValue("method", ep.method as any);
      setValue("name", `${ep.method} ${ep.path} Load Benchmark`);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      let parsedBody: Record<string, any> | undefined = undefined;
      if (values.payloadJson?.trim()) {
        try {
          parsedBody = JSON.parse(values.payloadJson.trim());
        } catch {
          throw new Error("Payload body must be valid JSON");
        }
      }

      const res = await fetchApi<{ testRun: Schemas["TestRun"] }>(
        `/api/v1/organizations/${orgId}/projects/${projectId}/load-tests`,
        {
          method: "POST",
          body: JSON.stringify({
            name: values.name.trim(),
            description: values.description?.trim() || undefined,
            targetUrl: values.targetUrl.trim(),
            method: values.method,
            profile: values.profile,
            concurrency: values.concurrency,
            durationSec: values.durationSec,
            rampUpSec: values.rampUpSec,
            body: parsedBody,
          }),
        }
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.loadTests.all(orgId, projectId) });
      const testRun = res.testRun || (res as any);
      router.push(`/app/organizations/${orgId}/projects/${projectId}/load-tests/${testRun.id}`);
    } catch (err: any) {
      setServerError(err.message || "Failed to configure load test");
    }
  };

  const PROFILES = [
    {
      id: "BREAKING_HUNT",
      title: "Breaking Point Hunt",
      desc: "Stepwise VU ramp to pinpoint saturation knee, p95 degradation, and service failure point.",
      badge: "Signature STRIM",
    },
    {
      id: "RAMP_UP",
      title: "Smooth Ramp-Up",
      desc: "Gradually increases traffic from 0 to maximum target concurrency over a designated window.",
      badge: "Capacity Sizing",
    },
    {
      id: "SUSTAINED",
      title: "Sustained Endurance",
      desc: "Holds a fixed concurrency load continuously to detect memory leaks and resource saturation.",
      badge: "Durability SLA",
    },
    {
      id: "SPIKE",
      title: "Spike Traffic",
      desc: "Instantaneous concurrency pulse to test recovery elasticity and autoscaling lag.",
      badge: "Elasticity Test",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
        title="Launch Load Test Wizard"
        description="Configure target HTTP endpoint, traffic generation profile, and saturation thresholds."
      />

      {/* Progress Steps */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        {[
          { num: 1, label: "Target & Endpoint" },
          { num: 2, label: "Load Profile & VUs" },
          { num: 3, label: "Review & Launch" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex size-6 items-center justify-center rounded-full text-xs font-mono font-bold ${
                step === s.num
                  ? "bg-brand text-brand-foreground"
                  : step > s.num
                  ? "bg-emerald-500 text-white"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {s.num}
            </div>
            <span
              className={`text-xs font-semibold ${
                step === s.num ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {serverError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border border-border bg-card p-6">
        {/* STEP 1: Target & Endpoint Selection */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground">Step 1: Choose Target Endpoint</h3>
              <p className="text-xs text-muted-foreground">Select a registered microservice or enter a target URL.</p>
            </div>

            {/* Service & Endpoint Selector */}
            {services.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Select Service</label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => {
                      setSelectedServiceId(e.target.value);
                      const svc = services.find((s) => s.id === e.target.value);
                      if (svc) setValue("targetUrl", svc.baseUrl);
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="">-- Manual URL --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.baseUrl})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Discovered Endpoint</label>
                  <select
                    onChange={(e) => onSelectEndpoint(e.target.value)}
                    disabled={!selectedServiceId || endpoints.length === 0}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none font-mono"
                  >
                    <option value="">
                      {endpoints.length === 0 ? "No endpoints discovered" : "-- Pick Endpoint --"}
                    </option>
                    {endpoints.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.method} {e.path}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Test Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Benchmark Name *</label>
              <Input {...register("name")} className="text-xs" />
              {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
            </div>

            {/* Target URL & Method */}
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1.5 col-span-1">
                <label className="text-xs font-medium text-foreground">HTTP Method</label>
                <select
                  {...register("method")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div className="space-y-1.5 col-span-3">
                <label className="text-xs font-medium text-foreground">Target URL (HTTPS) *</label>
                <Input
                  {...register("targetUrl")}
                  placeholder="https://api.yourdomain.com/v1/checkout"
                  className="text-xs font-mono"
                />
                {errors.targetUrl && (
                  <p className="text-[11px] text-destructive">{errors.targetUrl.message}</p>
                )}
              </div>
            </div>

            {/* Payload if mutation */}
            {["POST", "PUT", "PATCH"].includes(currentMethod) && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">JSON Request Payload (Optional)</label>
                <Textarea
                  {...register("payloadJson")}
                  placeholder='{ "userId": "test-user-1", "amount": 99.00 }'
                  className="text-xs font-mono min-h-[80px]"
                />
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-border">
              <Button type="button" size="sm" onClick={() => setStep(2)} className="gap-1.5">
                <span>Next: Load Profile</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Load Profile & Capacity Sizing */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground">Step 2: Traffic Profile &amp; Virtual Users</h3>
              <p className="text-xs text-muted-foreground">Choose concurrency scaling behavior and test duration.</p>
            </div>

            {/* Profile Selection Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROFILES.map((p) => {
                const selected = currentProfile === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setValue("profile", p.id as any)}
                    className={`rounded-xl border p-4 cursor-pointer transition-all ${
                      selected
                        ? "border-brand bg-brand/5 shadow-xs"
                        : "border-border hover:bg-surface-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{p.title}</span>
                      <Badge variant={selected ? "default" : "secondary"} className="text-[10px] font-mono">
                        {p.badge}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{p.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Concurrency, Duration, Ramp-up */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Virtual Users (VUs) *</label>
                <Input
                  type="number"
                  {...register("concurrency", { valueAsNumber: true })}
                  className="text-xs font-mono"
                  min={1}
                  max={1000}
                />
                <span className="text-[10px] text-muted-foreground">1 to 1,000 concurrent threads</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Duration (seconds) *</label>
                <Input
                  type="number"
                  {...register("durationSec", { valueAsNumber: true })}
                  className="text-xs font-mono"
                  min={5}
                  max={300}
                />
                <span className="text-[10px] text-muted-foreground">5 to 300 seconds</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Ramp-Up Window (sec)</label>
                <Input
                  type="number"
                  {...register("rampUpSec", { valueAsNumber: true })}
                  className="text-xs font-mono"
                  min={0}
                  max={120}
                />
                <span className="text-[10px] text-muted-foreground">Linear acceleration</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" size="sm" onClick={() => setStep(3)} className="gap-1.5">
                <span>Next: Review &amp; Launch</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Submit */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground">Step 3: Review Execution Parameters</h3>
              <p className="text-xs text-muted-foreground">Verify target safety limits and load generator parameters.</p>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Target URL:</span>
                <span className="font-semibold text-foreground break-all">{currentUrl}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">HTTP Method:</span>
                <HttpMethodBadge method={currentMethod} />
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Profile:</span>
                <Badge variant="outline" className="text-[10px]">{currentProfile}</Badge>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Concurrency:</span>
                <span className="text-foreground">{currentConcurrency} Virtual Users</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="text-foreground">{currentDuration} seconds total</span>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <ShieldAlert className="size-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                You are targeting an authorized application endpoint. Load generation is strictly rate-limited and logged in the organization audit trail.
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Configuring Test...</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5" />
                    <span>Create &amp; Open Console</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
