"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, Plus, Building2, Check } from "lucide-react"
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

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  role?: string
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { currentOrgId, setOrgId } = useUIStore()

  const { data: orgsResponse, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<ApiResponse<Organization[]>> => {
      return api.get<Organization[]>("/organizations")
    },
  })

  const organizations = React.useMemo(() => orgsResponse?.data || [], [orgsResponse?.data])
  const activeOrg = organizations.find((o) => o.id === currentOrgId) || organizations[0]

  // Automatically select the first organization if none is active
  React.useEffect(() => {
    if (!currentOrgId && organizations.length > 0) {
      setOrgId(organizations[0].id)
    }
  }, [currentOrgId, organizations, setOrgId])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-between gap-2 border border-border-subtle bg-surface/50 px-3 py-2 text-left hover:bg-surface-raised hover:text-foreground"
          />
        }
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-sand">
            <Building2 className="size-4" />
          </div>
          <div className="flex flex-col truncate leading-tight">
            <span className="truncate text-xs font-medium text-foreground">
              {isLoading ? "Loading workspaces..." : activeOrg ? activeOrg.name : "Select Workspace"}
            </span>
            <span className="truncate font-mono text-[10px] text-foreground-subtle">
              {activeOrg ? `org-${activeOrg.slug}` : "No workspace"}
            </span>
          </div>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-foreground-muted" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-64 border-border bg-surface-raised p-1 shadow-xl"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[11px] text-foreground-muted uppercase tracking-wider">
            Workspaces
          </DropdownMenuLabel>
          {organizations.map((org) => {
            const isSelected = org.id === activeOrg?.id
            return (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setOrgId(org.id)}
                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-xs hover:bg-surface-hover hover:text-foreground"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded bg-surface border border-border-subtle text-foreground-muted">
                    <Building2 className="size-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-foreground truncate">{org.name}</p>
                    <p className="font-mono text-[10px] text-foreground-subtle truncate">
                      {org.slug}
                    </p>
                  </div>
                </div>
                {isSelected && <Check className="size-3.5 text-brand shrink-0" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-border-subtle my-1" />
        <DropdownMenuItem
          onClick={() => router.push("/onboarding/organization")}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sand hover:bg-surface-hover hover:text-sand"
        >
          <Plus className="size-3.5" />
          <span>New Workspace</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
