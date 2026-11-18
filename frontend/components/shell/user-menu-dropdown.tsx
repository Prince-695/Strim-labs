"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { User, Building, LogOut, ChevronDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/lib/stores/auth-store"

export function UserMenuDropdown() {
  const router = useRouter()
  const { user, logout } = useAuthStore()

  // Calculate initials
  const initials = React.useMemo(() => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user?.first_name) {
      return user.first_name.slice(0, 2).toUpperCase()
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return "US"
  }, [user])

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user?.username ? `@${user.username}` : "Developer Account"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="User navigation menu"
            className="flex items-center gap-1.5 rounded-full p-1 hover:bg-surface-raised transition-all focus:outline-none focus:ring-1 focus:ring-brand"
          />
        }
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised border border-border text-foreground text-xs font-mono font-bold shadow-xs">
          {initials}
        </div>
        <ChevronDown className="size-3 text-foreground-subtle" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 border border-border bg-surface p-1 shadow-2xl font-mono text-xs rounded-xl"
      >
        {/* User Identity Header */}
        <div className="px-3 py-2 border-b border-border-subtle">
          <p className="text-xs font-bold text-foreground font-heading truncate">
            {displayName}
          </p>
          <p className="text-[10px] text-foreground-subtle truncate mt-0.5">
            {user?.email || (user?.username ? `@${user.username}` : "")}
          </p>
        </div>

        {/* Simplified Navigation Items: Profile Settings & Org Settings */}
        <DropdownMenuGroup className="py-1">
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/settings/profile")}
            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs rounded-lg hover:bg-surface-raised hover:text-foreground text-foreground-muted transition-colors"
          >
            <User className="size-4 text-foreground-subtle" />
            <span>Profile Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => router.push("/dashboard/settings/organization")}
            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs rounded-lg hover:bg-surface-raised hover:text-foreground text-foreground-muted transition-colors"
          >
            <Building className="size-4 text-foreground-subtle" />
            <span>Org Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-border-subtle my-1" />

        {/* Sign Out */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={logout}
            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-xs rounded-lg hover:bg-danger/10 hover:text-danger text-danger/90 transition-colors"
          >
            <LogOut className="size-4 text-danger" />
            <span className="font-semibold">Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
