"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layers, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi, type Schemas } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const createProjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60),
  description: z.string().max(300).optional(),
});

type CreateProjectValues = z.infer<typeof createProjectSchema>;

export default function OnboardingProjectPage() {
  const router = useRouter();
  const { currentOrgId, switchProject } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = async (values: CreateProjectValues) => {
    if (!currentOrgId) {
      setServerError("Please select or create an organization first.");
      router.push("/onboarding/organization");
      return;
    }

    setServerError(null);
    try {
      const res = await fetchApi<{ project: Schemas["Project"]; ingestKey?: string } | Schemas["Project"]>(
        `/api/v1/organizations/${currentOrgId}/projects`,
        {
          method: "POST",
          body: JSON.stringify(values),
        }
      );

      const newProject = res && typeof res === "object" && "project" in res && res.project
        ? res.project
        : (res as Schemas["Project"]);

      if (newProject?.id) {
        switchProject(newProject.id);
        router.push(`/onboarding/connect-service?projectId=${newProject.id}`);
      }
    } catch (err: any) {
      setServerError(err.message || "Failed to create project. Max 5 projects per organization.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6">
      {/* Stepper Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-4 border-b border-border">
        <span className="text-emerald-500 flex items-center gap-1">
          <CheckCircle2 className="size-4" /> Organization
        </span>
        <span className="text-muted-foreground/50">&rarr;</span>
        <span className="text-brand flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground text-[10px]">
            2
          </span>
          Project
        </span>
        <span className="text-muted-foreground/50">&rarr;</span>
        <span className="text-muted-foreground/60">3. Connect Service</span>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Create your first Project</h2>
        <p className="text-xs text-muted-foreground">
          Projects represent an application or system boundary, with dedicated ingest keys, services, and telemetry.
        </p>
      </div>

      {serverError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 leading-relaxed">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Project Name</Label>
          <div className="relative">
            <Input
              id="name"
              placeholder="e.g. Core API Gateway"
              disabled={isSubmitting}
              {...register("name")}
              className={errors.name ? "border-rose-500 pl-8" : "pl-8"}
            />
            <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          </div>
          {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="High-throughput payment gateway and inventory service routing..."
            rows={3}
            disabled={isSubmitting}
            {...register("description")}
          />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand-strong font-medium"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating Project...
              </>
            ) : (
              <>
                Continue to Service Setup
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
