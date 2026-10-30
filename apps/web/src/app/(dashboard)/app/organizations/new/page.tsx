"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building, Globe, AlignLeft, ArrowLeft, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchApi, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";

const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(64),
  website: z.string().url("Must be a valid URL (e.g. https://company.com)").optional().or(z.literal("")),
  description: z.string().max(256).optional(),
});

type FormValues = z.infer<typeof createOrgSchema>;

export default function NewOrganizationPage() {
  const router = useRouter();
  const { orgs, switchOrg, setOrgs } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const isCapReached = orgs.length >= 3;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      website: "",
      description: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const payload: { name: string; website?: string; description?: string } = {
        name: values.name.trim(),
      };
      if (values.website?.trim()) payload.website = values.website.trim();
      if (values.description?.trim()) payload.description = values.description.trim();

      const res = await fetchApi<{ organization: Schemas["Organization"] }>("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const newOrg = res.organization;
      setOrgs([...orgs, newOrg]);
      switchOrg(newOrg.id);
      router.push(`/app/organizations/${newOrg.id}/projects/new`);
    } catch (err: any) {
      setServerError(err.message || "Failed to create organization");
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
        title="Create New Organization"
        description="Establish an isolated enterprise workspace for your team and services."
      />

      {isCapReached ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-4 shrink-0" />
            <span>Organization Limit Reached (3 / 3)</span>
          </div>
          <p className="mt-1 text-xs text-rose-300/80">
            Your user account is already a member of the maximum allowed number of organizations.
            To create a new workspace, leave or delete an existing organization first.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border border-border bg-card p-6">
          {serverError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Org Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Organization Name *</label>
            <div className="relative">
              <Building className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                {...register("name")}
                placeholder="Acme Corporation"
                className="pl-9 text-xs"
                autoFocus
              />
            </div>
            {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Website (Optional)</label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                {...register("website")}
                placeholder="https://acme.inc"
                className="pl-9 text-xs"
              />
            </div>
            {errors.website && <p className="text-[11px] text-destructive">{errors.website.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Description (Optional)</label>
            <Textarea
              {...register("description")}
              placeholder="Primary engineering workspace for cloud and core services..."
              className="text-xs min-h-[80px]"
            />
            {errors.description && <p className="text-[11px] text-destructive">{errors.description.message}</p>}
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
                  <span>Creating Organization...</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Create Workspace</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
