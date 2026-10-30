"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi, type Schemas } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const createOrgSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().max(500).optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type CreateOrgValues = z.infer<typeof createOrgSchema>;

export default function OnboardingOrgPage() {
  const router = useRouter();
  const { switchOrg, refreshUserData } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: "", description: "", website: "" },
  });

  const onSubmit = async (values: CreateOrgValues) => {
    setServerError(null);
    try {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        website: values.website || undefined,
      };

      const res = await fetchApi<{ organization: Schemas["Organization"] } | Schemas["Organization"]>("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newOrg = res && typeof res === "object" && "organization" in res && res.organization
        ? res.organization
        : (res as Schemas["Organization"]);

      if (newOrg?.id) {
        switchOrg(newOrg.id);
      }
      await refreshUserData();
      router.push("/onboarding/project");
    } catch (err: any) {
      setServerError(err.message || "Failed to create organization. Max 3 organizations per user.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl space-y-6">
      {/* Stepper Header */}
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-4 border-b border-border">
        <span className="text-brand flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground text-[10px]">
            1
          </span>
          Organization
        </span>
        <span className="text-muted-foreground/50">&rarr;</span>
        <span className="text-muted-foreground/60">2. Project</span>
        <span className="text-muted-foreground/50">&rarr;</span>
        <span className="text-muted-foreground/60">3. Connect Service</span>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Create your Organization</h2>
        <p className="text-xs text-muted-foreground">
          Organizations group team members, projects, API keys, and subscription quotas.
        </p>
      </div>

      {serverError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 leading-relaxed">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Organization Name</Label>
          <div className="relative">
            <Input
              id="name"
              placeholder="e.g. Acme Corp"
              disabled={isSubmitting}
              {...register("name")}
              className={errors.name ? "border-rose-500 pl-8" : "pl-8"}
            />
            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          </div>
          {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="website">Website (Optional)</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://acme.com"
            disabled={isSubmitting}
            {...register("website")}
            className={errors.website ? "border-rose-500" : ""}
          />
          {errors.website && <p className="text-xs text-rose-500">{errors.website.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Brief overview of engineering team or systems..."
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
                Creating...
              </>
            ) : (
              <>
                Continue to Project Setup
                <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground border-t border-border/50">
        <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
        <span>You can create up to 3 organizations per account with role-based member permissions.</span>
      </div>
    </div>
  );
}
