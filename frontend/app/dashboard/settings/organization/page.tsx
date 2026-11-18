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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { orgApi } from "@/lib/org-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient()
  const { currentOrgId } = useUIStore()

  const [nameOverride, setNameOverride] = React.useState<string | null>(null)
  const [descOverride, setDescOverride] = React.useState<string | null>(null)
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
  const name = nameOverride !== null ? nameOverride : org?.name || ""
  const description =
    descOverride !== null ? descOverride : org?.description || ""

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
      setNameOverride(null)
      setDescOverride(null)
      setSaveSuccess(true)
      setSaveError(null)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err: unknown) => {
      setSaveError(
        err instanceof Error ? err.message : "Failed to update organization."
      )
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
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete organization."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
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
    <div className="max-w-3xl space-y-6 font-mono text-xs">
      {/* Overview Stats Bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4">
          <span className="text-[10px] text-foreground-subtle uppercase">
            Target Projects
          </span>
          <p className="text-xl font-bold text-foreground">
            {org.project_count || 0}
          </p>
          <p className="text-[10px] text-foreground-muted">
            Observability & load tests
          </p>
        </div>

        <div className="space-y-1 rounded-xl border border-border bg-surface p-4">
          <span className="text-[10px] text-foreground-subtle uppercase">
            Team Members
          </span>
          <p className="text-xl font-bold text-foreground">
            {org.member_count || 1}
          </p>
          <p className="text-[10px] text-foreground-muted">
            Workspace collaborators
          </p>
        </div>

        <div className="space-y-1 rounded-xl border border-border bg-surface p-4">
          <span className="text-[10px] text-foreground-subtle uppercase">
            Your Role
          </span>
          <p className="text-base font-bold text-sand uppercase">
            {org.role || "OWNER"}
          </p>
          <p className="text-[10px] text-foreground-muted">
            Workspace permissions
          </p>
        </div>
      </div>

      {/* General Org Profile Settings */}
      <Card className="border-border bg-surface shadow-xs">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
            <Building className="size-4 text-brand" />
            <span>Organization Profile</span>
          </CardTitle>
          <CardDescription className="font-mono text-xs text-foreground-muted">
            Manage your workspace name and identifiers used across CLI and
            dashboards.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
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
                onChange={(e) => setNameOverride(e.target.value)}
                placeholder="Acme Corp"
                className="border-border-subtle bg-surface-raised font-mono text-xs focus-visible:border-brand"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground-muted">
                Organization Slug (Read-only)
              </Label>
              <Input
                value={org.slug}
                disabled
                className="cursor-not-allowed border-border-subtle bg-surface-raised/40 font-mono text-xs opacity-70"
              />
              <span className="text-[10px] text-foreground-subtle">
                Immutable URL slug and namespace used for API targeting.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground-muted">
                Description (Optional)
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescOverride(e.target.value)}
                placeholder="Core backend services and API infrastructure"
                className="border-border-subtle bg-surface-raised font-mono text-xs focus-visible:border-brand"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-brand font-mono text-xs text-white hover:bg-brand-hover"
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
                    className: "gap-1.5 font-mono text-xs",
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
                    className: "gap-1.5 font-mono text-xs",
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
        <CardHeader className="border-b border-danger/20 pb-3">
          <div className="flex items-center gap-2 text-danger">
            <Trash2 className="size-4" />
            <CardTitle className="font-heading text-sm font-semibold">
              Danger Zone: Delete Organization
            </CardTitle>
          </div>
          <CardDescription className="font-mono text-xs text-foreground-muted">
            Permanently delete this organization, all registered target APIs,
            and test results.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-4 font-mono text-xs">
          {deleteError && (
            <p className="text-[11px] text-danger">{deleteError}</p>
          )}

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder={`Type "${org.slug}" to confirm`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="flex-1 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs text-foreground focus:border-danger focus:outline-none"
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirm !== org.slug || isDeleting}
              className="font-mono text-xs"
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
