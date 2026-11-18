"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronsUpDown,
  Plus,
  FolderKanban,
  Check,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react"
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
  const { currentOrgId, currentProjectId, setProjectId, setCreateProjectOpen } =
    useUIStore()

  const { data: projectsResponse, isLoading } = useQuery<
    ApiResponse<Project[]>
  >({
    queryKey: ["projects", currentOrgId],
    queryFn: async (): Promise<ApiResponse<Project[]>> => {
      if (!currentOrgId) {
        return { success: true, data: [] }
      }
      return api.get<Project[]>(`/organizations/${currentOrgId}/projects`)
    },
    enabled: Boolean(currentOrgId),
  })

  const projects = React.useMemo(
    () => projectsResponse?.data || [],
    [projectsResponse?.data]
  )
  const activeProject =
    projects.find((p) => p.id === currentProjectId) || projects[0]

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
            {isLoading
              ? "Loading..."
              : activeProject
                ? activeProject.name
                : "Select Project"}
          </span>
          {activeProject && (
            <span
              className={`py-0.2 rounded border px-1.5 font-mono text-[10px] tracking-wide uppercase ${
                envColorMap[activeProject.environment] ||
                "text-foreground-muted"
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
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[11px] tracking-wider text-foreground-muted uppercase">
            Projects & Target APIs
          </DropdownMenuLabel>
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
                    <span className="truncate font-medium text-foreground">
                      {project.name}
                    </span>
                    <span
                      className={`rounded border px-1 font-mono text-[9px] uppercase ${
                        envColorMap[project.environment] ||
                        "text-foreground-muted"
                      }`}
                    >
                      {project.environment}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[10px] text-foreground-subtle">
                    {isVerified ? (
                      <ShieldCheck className="size-3 shrink-0 text-success" />
                    ) : (
                      <ShieldAlert className="size-3 shrink-0 text-sand" />
                    )}
                    <span className="truncate">{project.base_url}</span>
                  </div>
                </div>
                {isSelected && (
                  <Check className="size-3.5 shrink-0 text-brand" />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1 bg-border-subtle" />
        <DropdownMenuItem
          onClick={() => setCreateProjectOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sand hover:bg-surface-hover hover:text-sand"
        >
          <Plus className="size-3.5" />
          <span>New Project / Target</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
