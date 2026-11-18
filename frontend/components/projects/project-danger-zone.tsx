"use client"

import * as React from "react"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"

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
      <CardHeader className="border-b border-danger/20 pb-3">
        <div className="flex items-center gap-2 text-danger">
          <Trash2 className="size-4" />
          <CardTitle className="font-heading text-sm font-semibold">
            Danger Zone: Delete Project
          </CardTitle>
        </div>
        <CardDescription className="font-mono text-xs text-foreground-muted">
          Deleting this project removes all recorded endpoints, telemetry
          timeseries, and load test runs. This action cannot be undone.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-4 font-mono text-xs">
        {deleteError && (
          <p className="text-[11px] text-danger">{deleteError}</p>
        )}

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder={`Type "${projectSlug}" to confirm`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="flex-1 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs text-foreground focus:border-danger focus:outline-none"
          />
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={deleteConfirm !== projectSlug || isDeleting}
            className="font-mono text-xs"
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
