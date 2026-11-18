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
    : user?.username
      ? `@${user.username}`
      : "Developer Account"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="User navigation menu"
            className="flex items-center gap-1.5 rounded-full p-1 transition-all hover:bg-surface-raised focus:ring-1 focus:ring-brand focus:outline-none"
          />
        }
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised font-mono text-xs font-bold text-foreground shadow-xs">
          {initials}
        </div>
        <ChevronDown className="size-3 text-foreground-subtle" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-xl border border-border bg-surface p-1 font-mono text-xs shadow-2xl"
      >
        {/* User Identity Header */}
        <div className="border-b border-border-subtle px-3 py-2">
          <p className="truncate font-heading text-xs font-bold text-foreground">
            {displayName}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-foreground-subtle">
            {user?.email || (user?.username ? `@${user.username}` : "")}
          </p>
        </div>

        {/* Simplified Navigation Items: Profile Settings & Org Settings */}
        <DropdownMenuGroup className="py-1">
          <DropdownMenuItem
            onClick={() => router.push("/dashboard/settings/profile")}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <User className="size-4 text-foreground-subtle" />
            <span>Profile Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => router.push("/dashboard/settings/organization")}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-foreground-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <Building className="size-4 text-foreground-subtle" />
            <span>Org Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1 bg-border-subtle" />

        {/* Sign Out */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={logout}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-danger/90 transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="size-4 text-danger" />
            <span className="font-semibold">Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
