"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Mail,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  AlertCircle,
  Camera,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof profileSchema>;

export default function UserProfilePage() {
  const { user: authUser, refreshUserData } = useAuth();
  const [successMessage, setSuccessMessage] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () =>
      fetchApi<{ user: Schemas["User"] }>("/api/v1/users/me").then((res) => res.user),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      avatarUrl: "",
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        name: data.name || "",
        avatarUrl: data.avatarUrl || "",
      });
    }
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: { name: string; avatarUrl?: string | null } = {
        name: values.name.trim(),
      };
      if (values.avatarUrl?.trim()) payload.avatarUrl = values.avatarUrl.trim();

      const res = await fetchApi<{ user: Schemas["User"] }>("/api/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return res.user;
    },
    onSuccess: async (updated) => {
      await refreshUserData();
      setSuccessMessage(true);
      setTimeout(() => setSuccessMessage(false), 3000);
      reset({
        name: updated.name || "",
        avatarUrl: updated.avatarUrl || "",
      });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to update profile");
    },
  });

  if (isLoading) return <LoadingState message="Loading developer account profile..." />;

  const user = data || authUser;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Personal Profile"
        description="Manage your developer account identity, avatar, and contact email."
      />

      {successMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>Profile changes saved successfully.</span>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
        className="space-y-6 rounded-xl border border-border bg-card p-6"
      >
        {/* Avatar Display */}
        <div className="flex items-center gap-4 border-b border-border pb-5">
          <Avatar className="size-16">
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || "User"} />}
            <AvatarFallback className="text-lg font-bold">
              {(user?.name || "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{user?.name || "Developer"}</h3>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Display Name *</label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input {...register("name")} className="pl-9 text-xs" />
          </div>
          {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
        </div>

        {/* Email (Read-Only) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Email Address</label>
            <Badge
              tone={user?.emailVerified ? "success" : "neutral"}
              className="text-[10px] font-mono"
            >
              {user?.emailVerified ? "VERIFIED" : "UNVERIFIED"}
            </Badge>
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input value={user?.email || ""} disabled className="pl-9 text-xs bg-surface-muted/50" />
          </div>
          <p className="text-[11px] text-muted-foreground">Primary login identifier.</p>
        </div>

        {/* Avatar URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Avatar Image URL (Optional)</label>
          <div className="relative">
            <Camera className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              {...register("avatarUrl")}
              placeholder="https://github.com/username.png"
              className="pl-9 text-xs font-mono"
            />
          </div>
          {errors.avatarUrl && (
            <p className="text-[11px] text-destructive">{errors.avatarUrl.message}</p>
          )}
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
                <span>Save Profile</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
