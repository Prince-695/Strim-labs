"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  RefreshCw,
  MoreVertical,
  AlertCircle,
  Loader2,
  Check,
  Send,
  X,
} from "lucide-react";
import { fetchApi, queryKeys, type Schemas } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/page-header";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["ADMIN", "ENGINEER", "DEVELOPER", "VIEWER"]),
});

type InviteForm = z.infer<typeof inviteSchema>;

const ROLES = [
  { value: "ADMIN", label: "Admin", desc: "Full organization & project management" },
  { value: "ENGINEER", label: "Engineer", desc: "Manage services, create load tests, trigger diagnostics" },
  { value: "DEVELOPER", label: "Developer", desc: "View telemetry, run manual tests" },
  { value: "VIEWER", label: "Viewer", desc: "Read-only access to dashboards & reports" },
];

export default function OrganizationMembersPage({ params }: PageProps) {
  const { orgId } = use(params);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Members
  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: queryKeys.organizations.members(orgId),
    queryFn: () =>
      fetchApi<{ members: Schemas["Member"][] }>(`/api/v1/organizations/${orgId}/members`).then(
        (res) => res.members
      ),
  });

  // Fetch Pending Invitations
  const {
    data: invitations,
    isLoading: invitesLoading,
    refetch: refetchInvites,
  } = useQuery({
    queryKey: queryKeys.organizations.invitations(orgId),
    queryFn: () =>
      fetchApi<{ invitations: Schemas["Invitation"][] }>(
        `/api/v1/organizations/${orgId}/invitations`
      ).then((res) => res.invitations),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: inviteErrors, isSubmitting: isInviting },
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "ENGINEER",
    },
  });

  // Send Invitation Mutation
  const inviteMutation = useMutation({
    mutationFn: async (values: InviteForm) => {
      await fetchApi<{ invitation: Schemas["Invitation"] }>(
        `/api/v1/organizations/${orgId}/invitations`,
        {
          method: "POST",
          body: JSON.stringify(values),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations(orgId) });
      setInviteModalOpen(false);
      reset();
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to send invitation");
    },
  });

  // Update Member Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await fetchApi<{ ok: boolean }>(`/api/v1/organizations/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(orgId) });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to update role");
    },
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await fetchApi<{ ok: boolean }>(`/api/v1/organizations/${orgId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.members(orgId) });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to remove member");
    },
  });

  // Cancel Invitation Mutation
  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await fetchApi<{ ok: boolean }>(
        `/api/v1/organizations/${orgId}/invitations/${invitationId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitations(orgId) });
    },
    onError: (err: any) => {
      setActionError(err.message || "Failed to cancel invitation");
    },
  });

  if (membersLoading || invitesLoading) {
    return <LoadingState message="Loading organization team members..." />;
  }

  if (membersError) {
    return (
      <ErrorState
        title="Failed to load members"
        description={(membersError as any)?.message || "Could not retrieve member roster."}
        onRetry={refetchMembers}
      />
    );
  }

  const memberList = members || [];
  const inviteList = invitations || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team Members &amp; Access"
        description="Manage role-based access control, pending invitations, and developer permissions."
        action={
          <Button
            size="sm"
            onClick={() => {
              setActionError(null);
              setInviteModalOpen(true);
            }}
            className="gap-1.5"
          >
            <UserPlus className="size-4" />
            <span>Invite Member</span>
          </Button>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Active Members Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-4 flex items-center justify-between bg-surface-muted/30">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Active Members</h3>
            <p className="text-xs text-muted-foreground">{memberList.length} authenticated users with tenant access</p>
          </div>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Member</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Joined Date</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {memberList.map((m) => {
              const isSelf = m.userId === currentUser?.id;
              const isOwner = m.role === "OWNER";

              return (
                <TR key={m.userId}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[11px] font-semibold">
                          {(m.name || m.email).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground text-xs">
                        {m.name || "Developer"}
                        {isSelf && <span className="ml-1 text-[10px] text-muted-foreground font-mono">(You)</span>}
                      </span>
                    </div>
                  </TD>
                  <TD className="text-xs text-muted-foreground font-mono">{m.email}</TD>
                  <TD>
                    <Badge
                      variant={isOwner ? "default" : "secondary"}
                      className="text-[10px] font-mono tracking-wider"
                    >
                      {m.role}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground font-mono">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </TD>
                  <TD className="text-right">
                    {!isOwner && !isSelf && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1 rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground">
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r.value}
                              disabled={m.role === r.value}
                              onClick={() => updateRoleMutation.mutate({ userId: m.userId, role: r.value })}
                              className="text-xs"
                            >
                              Set to {r.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            onClick={() => removeMemberMutation.mutate(m.userId)}
                            className="text-xs text-destructive font-medium"
                          >
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      {/* Pending Invitations Table */}
      {inviteList.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border p-4 bg-surface-muted/30">
            <h3 className="text-sm font-semibold text-foreground">Pending Invitations</h3>
            <p className="text-xs text-muted-foreground">Outstanding email invites waiting for acceptance</p>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Invited Email</TH>
                <TH>Assigned Role</TH>
                <TH>Sent At</TH>
                <TH>Expires</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {inviteList.map((inv) => (
                <TR key={inv.id}>
                  <TD className="text-xs font-mono text-foreground">{inv.email}</TD>
                  <TD>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {inv.role}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground font-mono">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </TD>
                  <TD className="text-xs text-muted-foreground font-mono">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInviteMutation.mutate(inv.id)}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Cancel
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {/* Invite Member Dialog */}
      <Dialog
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        title="Invite Team Member"
        description="An invitation link will be generated for the user to join this organization."
      >
        <form onSubmit={handleSubmit((values) => inviteMutation.mutate(values))} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Work Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                {...register("email")}
                placeholder="colleague@company.com"
                className="pl-9 text-xs"
                autoFocus
              />
            </div>
            {inviteErrors.email && (
              <p className="text-[11px] text-destructive">{inviteErrors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Assigned Role *</label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 hover:bg-surface-muted/50 cursor-pointer"
                >
                  <input
                    type="radio"
                    value={r.value}
                    {...register("role")}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground">{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isInviting || inviteMutation.isPending} className="gap-1.5">
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Sending Invitation...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>Send Invitation</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
