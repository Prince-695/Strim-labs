"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  Mail,
  Slack,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";

const notificationSchema = z.object({
  notifyEmail: z.boolean(),
  notifySlack: z.boolean(),
});

type FormValues = z.infer<typeof notificationSchema>;

export default function NotificationSettingsPage() {
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
    watch,
    formState: { isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      notifyEmail: true,
      notifySlack: false,
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        notifyEmail: data.notifyEmail,
        notifySlack: data.notifySlack,
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
        notifyEmail: updated.notifyEmail,
        notifySlack: updated.notifySlack,
      });
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update notification settings");
    },
  });

  if (isLoading) return <LoadingState message="Loading notification preferences..." />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notification Channels"
        description="Configure automated alert dispatch for capacity degradations and breaking points."
      />

      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>Notification settings updated successfully.</span>
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
        <div className="space-y-4">
          {/* Email notifications */}
          <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 hover:bg-surface-muted/30 cursor-pointer">
            <div className="flex items-start gap-3">
              <Mail className="size-5 text-brand shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-foreground">Critical Incident Email Alerts</div>
                <div className="text-[11px] text-muted-foreground">
                  Send immediate notifications to your account email when p95 latency spikes exceed 500ms or error rates exceed 5%.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              {...register("notifyEmail")}
              className="size-4 mt-1 rounded border-border"
            />
          </label>

          {/* Slack notifications */}
          <label className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 hover:bg-surface-muted/30 cursor-pointer">
            <div className="flex items-start gap-3">
              <Slack className="size-5 text-[#E01E5A] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-foreground">Slack Workspace Notifications</div>
                <div className="text-[11px] text-muted-foreground">
                  Broadcast breaking point completions and saturation knee detections to connected team Slack channels.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              {...register("notifySlack")}
              className="size-4 mt-1 rounded border-border"
            />
          </label>
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
                <span>Save Notification Settings</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
