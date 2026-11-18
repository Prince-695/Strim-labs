"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { authApi } from "@/lib/auth-api"
import { orgApi } from "@/lib/org-api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useUIStore } from "@/lib/stores/ui-store"
import { tokenStorage } from "@/lib/api-client"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const { setCurrentOrgId } = useUIStore()

  React.useEffect(() => {
    const handleAuth = async () => {
      try {
        const errorParam = searchParams.get("error") || searchParams.get("code")
        const detailParam = searchParams.get("detail")
        const statusParam = searchParams.get("status")
        if (statusParam === "error" || errorParam) {
          const combinedMsg = detailParam
            ? `${errorParam} - ${detailParam}`
            : errorParam || "oauth_failed"
          router.push(`/login?error=${encodeURIComponent(combinedMsg)}`)
          return
        }

        const tokenFromUrl = searchParams.get("token")
        if (tokenFromUrl) {
          tokenStorage.set(tokenFromUrl)
        }

        const activeToken = tokenStorage.get() || tokenFromUrl
        if (!activeToken) {
          // No token received from backend OAuth redirect
          console.warn("Auth callback: No token received in URL or cookies.")
          router.push("/login?error=missing_token")
          return
        }

        // Fetch current user details
        const meRes = await authApi.getMe()
        if (meRes.data?.user) {
          setAuth(activeToken, meRes.data.user)

          // For OAuth authenticated & verified users, redirect directly to dashboard
          try {
            const orgsRes = await orgApi.list()
            const orgs = orgsRes.data || []
            if (orgs.length > 0) {
              setCurrentOrgId(orgs[0].id)
            }
          } catch {
            // Ignore org lookup errors and proceed directly to dashboard
          }
          router.push("/dashboard")
        } else {
          router.push("/dashboard")
        }
      } catch (err) {
        console.error("Auth callback error:", err)
        if (tokenStorage.get()) {
          router.push("/dashboard")
        } else {
          router.push("/login?error=oauth_failed")
        }
      }
    }

    handleAuth()
  }, [router, searchParams, setAuth, setCurrentOrgId])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <div className="flex flex-col items-center gap-3 font-mono text-xs text-foreground-muted">
        <Loader2 className="size-6 animate-spin text-brand" />
        <p>Completing authentication and establishing session...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthCallbackContent />
    </React.Suspense>
  )
}
