"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Smartphone,
  Laptop,
  Clock,
  Lock,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof changePasswordSchema>;

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Fetch Active Sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: queryKeys.users.sessions(),
    queryFn: () =>
      fetchApi<{ sessions: Schemas["SessionInfo"][] }>("/api/v1/users/me/sessions").then(
        (res) => res.sessions
      ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Change Password Mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (values: PasswordForm) => {
      return fetchApi<{ ok: boolean }>("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError(null);
      reset();
      setTimeout(() => setPasswordSuccess(false), 4000);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions() });
    },
    onError: (err: any) => {
      setPasswordError(err.message || "Failed to update password");
    },
  });

  // Revoke Session Mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await fetchApi<{ ok: boolean }>(`/api/v1/users/me/sessions/${sessionId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.sessions() });
    },
  });

  if (sessionsLoading) return <LoadingState message="Checking active session credentials..." />;

  const sessions = sessionsData || [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Security &amp; Sessions"
        description="Password management, authenticated devices, and session authorization controls."
      />

      {/* Change Password Card */}
      <form
        onSubmit={handleSubmit((values) => changePasswordMutation.mutate(values))}
        className="space-y-5 rounded-xl border border-border bg-card p-6"
      >
        <div className="border-b border-border pb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lock className="size-4 text-brand" />
            <span>Change Account Password</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Updating your password will revoke all other active sessions across devices.
          </p>
        </div>

        {passwordSuccess && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>Password updated successfully. Other device sessions revoked.</span>
          </div>
        )}

        {passwordError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Current Password *</label>
          <Input
            type="password"
            {...register("currentPassword")}
            className="text-xs font-mono"
            autoComplete="current-password"
          />
          {formErrors.currentPassword && (
            <p className="text-[11px] text-destructive">{formErrors.currentPassword.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">New Password *</label>
            <Input
              type="password"
              {...register("newPassword")}
              className="text-xs font-mono"
              autoComplete="new-password"
            />
            {formErrors.newPassword && (
              <p className="text-[11px] text-destructive">{formErrors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Confirm New Password *</label>
            <Input
              type="password"
              {...register("confirmPassword")}
              className="text-xs font-mono"
              autoComplete="new-password"
            />
            {formErrors.confirmPassword && (
              <p className="text-[11px] text-destructive">{formErrors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || changePasswordMutation.isPending}
            className="gap-1.5"
          >
            {changePasswordMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" />
                <span>Update Password</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Active Sessions Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-5 bg-surface-muted/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Laptop className="size-4 text-brand" />
            <span>Active Login Sessions</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Current browsers and devices with active access tokens to your account.
          </p>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Client Device / Browser</TH>
              <TH>IP Address</TH>
              <TH>Last Active</TH>
              <TH>Session Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {sessions.map((sess) => (
              <TR key={sess.id}>
                <TD className="text-xs font-mono text-foreground max-w-xs truncate">
                  {sess.userAgent || "Web Browser"}
                </TD>
                <TD className="text-xs font-mono text-muted-foreground">
                  {sess.ipAddress || "127.0.0.1"}
                </TD>
                <TD className="text-xs font-mono text-muted-foreground">
                  {new Date(sess.lastActiveAt).toLocaleString()}
                </TD>
                <TD>
                  {sess.isCurrent ? (
                    <Badge tone="brand" className="font-mono text-[10px]">
                      THIS DEVICE
                    </Badge>
                  ) : (
                    <Badge tone="neutral" className="font-mono text-[10px]">
                      ACTIVE
                    </Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {!sess.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeSessionMutation.mutate(sess.id)}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3 mr-1" /> Revoke
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
