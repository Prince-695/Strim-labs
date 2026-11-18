"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/stores/auth-store"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, isLoading, initialize } = useAuthStore()

  React.useEffect(() => {
    initialize()
  }, [initialize])

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`
      router.replace(redirectUrl)
    }
  }, [isLoading, isAuthenticated, router, pathname])

  // While checking auth token or if unauthenticated, show a branded loading state
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-xl border border-border bg-surface-raised flex items-center justify-center shadow-lg animate-pulse p-2 overflow-hidden">
            <Image
              src="/logo.png"
              alt="Strim Labs Logo"
              width={36}
              height={36}
              priority
              className="size-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
            <span>VERIFYING SESSION...</span>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
