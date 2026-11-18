"use client"

import * as React from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Building,
  Users,
  Key,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ArrowRight,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { orgApi } from "@/lib/org-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient()
  const { currentOrgId } = useUIStore()

  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = React.useState("")
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // 1. Fetch Organization Details
  const { data: orgRes, isLoading } = useQuery({
    queryKey: ["org_detail", currentOrgId],
    queryFn: () => orgApi.get(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  const org = orgRes?.data

  // Sync form inputs when org is loaded
  React.useEffect(() => {
    if (org) {
      setName(org.name || "")
      setDescription(org.description || "")
    }
  }, [org])

  // 2. Update Org Mutation
  const updateMutation = useMutation({
    mutationFn: () =>
      orgApi.update(currentOrgId!, {
        name: name.trim(),
        description: description.trim(),
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(["org_detail", currentOrgId], res)
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      setSaveSuccess(true)
      setSaveError(null)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : "Failed to update organization.")
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setSaveError("Organization name cannot be empty.")
      return
    }
    setSaveError(null)
    updateMutation.mutate()
  }

  const handleDelete = async () => {
    if (!currentOrgId || !org) return
    if (deleteConfirm !== org.slug) {
      setDeleteError(`Please type "${org.slug}" to confirm deletion.`)
      return
    }

    try {
      setIsDeleting(true)
      setDeleteError(null)
      await orgApi.delete(currentOrgId, org.slug)
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
      window.location.href = "/onboarding/organization"
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete organization.")
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!org) {
    return (
      <Card className="border-border bg-surface p-8 text-center font-mono text-xs text-foreground-muted">
        No organization workspace selected or accessible.
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl font-mono text-xs">
      {/* Overview Stats Bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
          <span className="text-[10px] text-foreground-subtle uppercase">Target Projects</span>
          <p className="text-xl font-bold text-foreground">{org.project_count || 0}</p>
          <p className="text-[10px] text-foreground-muted">Observability & load tests</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
          <span className="text-[10px] text-foreground-subtle uppercase">Team Members</span>
          <p className="text-xl font-bold text-foreground">{org.member_count || 1}</p>
          <p className="text-[10px] text-foreground-muted">Workspace collaborators</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
          <span className="text-[10px] text-foreground-subtle uppercase">Your Role</span>
          <p className="text-base font-bold text-sand uppercase">{org.role || "OWNER"}</p>
          <p className="text-[10px] text-foreground-muted">Workspace permissions</p>
        </div>
      </div>

      {/* General Org Profile Settings */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="pb-4 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold font-heading text-foreground flex items-center gap-2">
            <Building className="size-4 text-brand" />
            <span>Organization Profile</span>
          </CardTitle>
          <CardDescription className="text-xs text-foreground-muted font-mono">
            Manage your workspace name and identifiers used across CLI and dashboards.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2.5 text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Organization updated successfully.</span>
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
              <AlertCircle className="size-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground-muted">Organization Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground-muted">Organization Slug (Read-only)</Label>
              <Input
                value={org.slug}
                disabled
                className="text-xs font-mono bg-surface-raised/40 border-border-subtle opacity-70 cursor-not-allowed"
              />
              <span className="text-[10px] text-foreground-subtle">
                Immutable URL slug and namespace used for API targeting.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground-muted">Description (Optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Core backend services and API infrastructure"
                className="text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-brand text-white hover:bg-brand-hover text-xs font-mono"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Organization Changes</span>
                )}
              </Button>

              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/settings/members"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "text-xs font-mono gap-1.5",
                  })}
                >
                  <Users className="size-3.5" />
                  <span>Manage Members</span>
                </Link>
                <Link
                  href="/dashboard/settings/api-keys"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "text-xs font-mono gap-1.5",
                  })}
                >
                  <Key className="size-3.5" />
                  <span>API Keys</span>
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone: Delete Organization */}
      <Card className="border-danger/30 bg-surface">
        <CardHeader className="pb-3 border-b border-danger/20">
          <div className="flex items-center gap-2 text-danger">
            <Trash2 className="size-4" />
            <CardTitle className="text-sm font-semibold font-heading">
              Danger Zone: Delete Organization
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-foreground-muted font-mono">
            Permanently delete this organization, all registered target APIs, and test results.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 space-y-3 font-mono text-xs">
          {deleteError && <p className="text-danger text-[11px]">{deleteError}</p>}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              placeholder={`Type "${org.slug}" to confirm`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-danger flex-1"
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirm !== org.slug || isDeleting}
              className="text-xs font-mono"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Permanently Delete Organization</span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
