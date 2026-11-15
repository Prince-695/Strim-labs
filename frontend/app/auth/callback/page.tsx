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
        const tokenFromUrl = searchParams.get("token")
        if (tokenFromUrl) {
          tokenStorage.set(tokenFromUrl)
        }

        // Fetch current user details
        const meRes = await authApi.getMe()
        if (meRes.data?.user) {
          const currentToken = tokenStorage.get() || tokenFromUrl || ""
          setAuth(currentToken, meRes.data.user)

          // Route to org onboarding or dashboard
          try {
            const orgsRes = await orgApi.list()
            const orgs = orgsRes.data || []
            if (orgs.length > 0) {
              setCurrentOrgId(orgs[0].id)
              router.push("/dashboard")
            } else {
              router.push("/onboarding/organization")
            }
          } catch {
            router.push("/onboarding/organization")
          }
        } else {
          router.push("/login")
        }
      } catch (err) {
        console.error("Auth callback error:", err)
        router.push("/login?error=oauth_failed")
      }
    }

    handleAuth()
  }, [router, searchParams, setAuth, setCurrentOrgId])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="flex flex-col items-center gap-3 font-mono text-xs text-foreground-muted">
        <Loader2 className="size-6 text-brand animate-spin" />
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
