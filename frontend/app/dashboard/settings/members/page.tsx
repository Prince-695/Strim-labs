"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  UserPlus,
  Trash2,
  Loader2,
  AlertCircle,
  Mail
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { orgApi, type OrgMember, type OrgRole } from "@/lib/org-api"
import { useUIStore } from "@/lib/stores/ui-store"

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: "bg-brand/20 text-brand border-brand/30",
  admin: "bg-warning/20 text-warning border-warning/30",
  member: "bg-surface-raised text-sand border-border-subtle",
  viewer: "bg-surface-raised text-foreground-subtle border-border-subtle",
}

export default function MembersSettingsPage() {
  const queryClient = useQueryClient()
  const { currentOrgId } = useUIStore()

  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<OrgRole>("member")
  const [inviteError, setInviteError] = React.useState<string | null>(null)

  // 1. Fetch Members List
  const { data: membersRes, isLoading } = useQuery({
    queryKey: ["org_members", currentOrgId],
    queryFn: () => orgApi.listMembers(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  // 2. Add Member Mutation
  const addMutation = useMutation({
    mutationFn: () =>
      orgApi.addMember(currentOrgId!, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_members", currentOrgId] })
      setIsInviteModalOpen(false)
      setInviteEmail("")
      setInviteError(null)
    },
    onError: (err: unknown) => {
      setInviteError(err instanceof Error ? err.message : "Failed to invite member.")
    },
  })

  // 3. Update Role Mutation
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      orgApi.updateMemberRole(currentOrgId!, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_members", currentOrgId] })
    },
  })

  // 4. Remove Member Mutation
  const removeMutation = useMutation({
    mutationFn: (userId: string) => orgApi.removeMember(currentOrgId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_members", currentOrgId] })
    },
  })

  const members = membersRes?.data || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold font-heading text-foreground">
            Workspace Team Members
          </h3>
          <p className="text-xs text-foreground-muted font-mono">
            Users with access to this tenant workspace and its API telemetry projects.
          </p>
        </div>

        <Button
          onClick={() => setIsInviteModalOpen(true)}
          className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
        >
          <UserPlus className="size-3.5" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-border bg-surface shadow-2xl">
            <CardHeader className="pb-4 border-b border-border-subtle">
              <CardTitle className="text-base font-semibold font-heading text-foreground">
                Invite New Team Member
              </CardTitle>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                An invitation will be linked to this member with the assigned RBAC role.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-5 space-y-4 font-mono text-xs">
              {inviteError && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{inviteError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-foreground-muted">Member Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-3.5 text-foreground-subtle" />
                  <Input
                    type="email"
                    placeholder="colleague@acme.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-8 text-xs font-mono bg-surface-raised border-border-subtle"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground-muted">Role Permissions</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-brand"
                >
                  <option value="admin">Admin (Manage settings, members & delete)</option>
                  <option value="member">Member (Create and launch tests)</option>
                  <option value="viewer">Viewer (Read-only observability access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={addMutation.isPending}
                  className="text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => addMutation.mutate()}
                  disabled={!inviteEmail || addMutation.isPending}
                  className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                >
                  {addMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Sending Invite...</span>
                    </>
                  ) : (
                    <span>Add Member</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members List Card */}
      <Card className="border-border bg-surface shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-foreground-muted">
              No members found in this workspace.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                    <th className="py-3 px-4 font-semibold">User</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold">Joined At</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {members.map((member: OrgMember) => (
                    <tr key={member.user_id} className="hover:bg-surface-raised/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="py-3.5 px-4 text-foreground-muted">
                        {member.email}
                      </td>
                      <td className="py-3.5 px-4">
                        {member.role === "owner" ? (
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${ROLE_COLORS.owner}`}>
                            OWNER
                          </span>
                        ) : (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              roleMutation.mutate({
                                userId: member.user_id,
                                role: e.target.value as OrgRole,
                              })
                            }
                            className="rounded border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-foreground"
                          >
                            <option value="admin">ADMIN</option>
                            <option value="member">MEMBER</option>
                            <option value="viewer">VIEWER</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-foreground-subtle">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {member.role !== "owner" && (
                          <button
                            onClick={() => removeMutation.mutate(member.user_id)}
                            disabled={removeMutation.isPending}
                            title="Remove member from workspace"
                            className="text-foreground-subtle hover:text-danger p-1 rounded transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
