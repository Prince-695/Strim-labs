"use client"

import * as React from "react"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface ProjectDangerZoneProps {
  projectSlug: string
  deleteConfirm: string
  setDeleteConfirm: (val: string) => void
  onDelete: () => void
  isDeleting: boolean
  deleteError: string | null
}

export function ProjectDangerZone({
  projectSlug,
  deleteConfirm,
  setDeleteConfirm,
  onDelete,
  isDeleting,
  deleteError,
}: ProjectDangerZoneProps) {
  return (
    <Card className="border-danger/30 bg-surface">
      <CardHeader className="pb-3 border-b border-danger/20">
        <div className="flex items-center gap-2 text-danger">
          <Trash2 className="size-4" />
          <CardTitle className="text-sm font-semibold font-heading">
            Danger Zone: Delete Project
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-foreground-muted font-mono">
          Deleting this project removes all recorded endpoints, telemetry timeseries, and load test runs. This action cannot be undone.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-3 font-mono text-xs">
        {deleteError && <p className="text-danger text-[11px]">{deleteError}</p>}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder={`Type "${projectSlug}" to confirm`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-danger flex-1"
          />
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={deleteConfirm !== projectSlug || isDeleting}
            className="text-xs font-mono"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Permanently Delete Project</span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
