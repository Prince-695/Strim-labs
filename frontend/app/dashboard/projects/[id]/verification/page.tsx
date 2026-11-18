"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"

export default function TargetVerificationRedirect() {
  const params = useParams()
  const router = useRouter()
  const projectId = (params?.id as string) || ""

  React.useEffect(() => {
    if (projectId) {
      router.replace(`/dashboard/projects/${projectId}`)
    } else {
      router.replace("/dashboard/projects")
    }
  }, [projectId, router])

  return (
    <div className="flex h-64 items-center justify-center font-mono text-xs text-foreground-muted">
      Redirecting to project cockpit...
    </div>
  )
}
