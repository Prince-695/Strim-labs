"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sliders,
  Globe,
  Clock,
  SunMoon,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";

const preferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  timezone: z.string(),
  locale: z.string(),
});

type FormValues = z.infer<typeof preferencesSchema>;

export default function PreferencesPage() {
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.preferences(),
    queryFn: () =>
      fetchApi<{ preferences: Schemas["UserPreferences"] }>("/api/v1/users/me/preferences").then(
        (res) => res.preferences
      ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      theme: "dark",
      timezone: "UTC",
      locale: "en-US",
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        theme: (data.theme as any) || "dark",
        timezone: data.timezone || "UTC",
        locale: data.locale || "en-US",
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetchApi<{ preferences: Schemas["UserPreferences"] }>(
        "/api/v1/users/me/preferences",
        {
          method: "PATCH",
          body: JSON.stringify(values),
        }
      );
      return res.preferences;
    },
    onSuccess: (updated) => {
      setSuccess(true);
      setErrorMsg(null);
      reset({
        theme: (updated.theme as any) || "dark",
        timezone: updated.timezone || "UTC",
        locale: updated.locale || "en-US",
      });
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update preferences");
    },
  });

  if (isLoading) return <LoadingState message="Loading developer preferences..." />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Preferences"
        description="Theme customizations, telemetry timestamp formatting, and regional language locales."
      />

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>Preferences updated successfully.</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        className="space-y-6 rounded-xl border border-border bg-card p-6"
      >
        {/* Theme */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-2">
            <SunMoon className="size-3.5 text-brand" />
            <span>Console Theme Interface</span>
          </label>
          <select
            {...register("theme")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
          >
            <option value="dark">Dark Theme (Default developer-tool dark aesthetic)</option>
            <option value="light">Light Theme</option>
            <option value="system">Follow System OS Settings</option>
          </select>
        </div>

        {/* Timezone */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-2">
            <Clock className="size-3.5 text-brand" />
            <span>Telemetry Timezone</span>
          </label>
          <select
            {...register("timezone")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none font-mono"
          >
            <option value="UTC">UTC (Coordinated Universal Time)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Europe/Berlin">Europe/Berlin (CET)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          </select>
        </div>

        {/* Locale */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-2">
            <Globe className="size-3.5 text-brand" />
            <span>Locale Formatting</span>
          </label>
          <select
            {...register("locale")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none font-mono"
          >
            <option value="en-US">English (United States) — 1,000.00</option>
            <option value="en-GB">English (United Kingdom) — 1,000.00</option>
            <option value="de-DE">German (Germany) — 1.000,00</option>
            <option value="ja-JP">Japanese (Japan) — 1,000</option>
          </select>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || isSubmitting || updateMutation.isPending}
            className="gap-1.5"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                <span>Save Preferences</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
