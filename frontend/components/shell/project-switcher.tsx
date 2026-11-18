"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, Plus, FolderKanban, Check, ShieldCheck, ShieldAlert } from "lucide-react"
import { api, type ApiResponse } from "@/lib/api-client"
import { useUIStore } from "@/lib/stores/ui-store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface Project {
  id: string
  org_id: string
  name: string
  slug: string
  description?: string
  base_url: string
  environment: "development" | "staging" | "production"
  verification_status: "unverified" | "pending" | "verified" | "failed"
  endpoint_count?: number
  health?: "healthy" | "degraded" | "failing" | "no_data"
}

export function ProjectSwitcher() {
  const router = useRouter()
  const { currentOrgId, currentProjectId, setProjectId } = useUIStore()

  const { data: projectsResponse, isLoading } = useQuery<ApiResponse<Project[]>>({
    queryKey: ["projects", currentOrgId],
    queryFn: async (): Promise<ApiResponse<Project[]>> => {
      if (!currentOrgId) {
        return { success: true, data: [] }
      }
      return api.get<Project[]>(`/organizations/${currentOrgId}/projects`)
    },
    enabled: Boolean(currentOrgId),
  })

  const projects = React.useMemo(() => projectsResponse?.data || [], [projectsResponse?.data])
  const activeProject = projects.find((p) => p.id === currentProjectId) || projects[0]

  // Automatically select the first project if none is active
  React.useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setProjectId(projects[0].id)
    }
  }, [currentProjectId, projects, setProjectId])

  const envColorMap: Record<string, string> = {
    production: "text-danger border-danger/30 bg-danger-subtle",
    staging: "text-warning border-warning/30 bg-warning-subtle",
    development: "text-sand border-sand/30 bg-sand-subtle",
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 max-w-[240px] justify-between gap-2 border-border-subtle bg-surface/40 px-2.5 text-xs hover:bg-surface-raised hover:text-foreground"
          />
        }
      >
        <div className="flex items-center gap-2 truncate">
          <FolderKanban className="size-3.5 shrink-0 text-brand" />
          <span className="truncate font-medium text-foreground">
            {isLoading ? "Loading..." : activeProject ? activeProject.name : "Select Project"}
          </span>
          {activeProject && (
            <span
              className={`rounded px-1.5 py-0.2 font-mono text-[10px] uppercase tracking-wide border ${
                envColorMap[activeProject.environment] || "text-foreground-muted"
              }`}
            >
              {activeProject.environment.slice(0, 4)}
            </span>
          )}
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-foreground-muted" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-72 border-border bg-surface-raised p-1 shadow-xl"
      >
        <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[11px] text-foreground-muted uppercase tracking-wider">
          Projects & Target APIs
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {projects.map((project) => {
            const isSelected = project.id === activeProject?.id
            const isVerified = project.verification_status === "verified"

            return (
              <DropdownMenuItem
                key={project.id}
                onClick={() => setProjectId(project.id)}
                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-xs hover:bg-surface-hover hover:text-foreground"
              >
                <div className="flex flex-col truncate pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{project.name}</span>
                    <span
                      className={`rounded px-1 text-[9px] font-mono uppercase border ${
                        envColorMap[project.environment] || "text-foreground-muted"
                      }`}
                    >
                      {project.environment}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-foreground-subtle font-mono truncate">
                    {isVerified ? (
                      <ShieldCheck className="size-3 text-success shrink-0" />
                    ) : (
                      <ShieldAlert className="size-3 text-sand shrink-0" />
                    )}
                    <span className="truncate">{project.base_url}</span>
                  </div>
                </div>
                {isSelected && <Check className="size-3.5 text-brand shrink-0" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border-subtle my-1" />
        <DropdownMenuItem
          onClick={() => router.push("/onboarding/project")}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sand hover:bg-surface-hover hover:text-sand"
        >
          <Plus className="size-3.5" />
          <span>New Project / Target</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
