"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Globe,
  Play
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { projectApi, type VerificationMethod } from "@/lib/project-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function TargetVerificationPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentOrgId } = useUIStore()

  const projectId = (params?.id as string) || ""
  const [method, setMethod] = React.useState<VerificationMethod>("dns")
  const [copiedField, setCopiedField] = React.useState<string | null>(null)
  const [checkResult, setCheckResult] = React.useState<{ status: string; reason?: string } | null>(null)

  // 1. Fetch Project Details
  const { data: projectRes, isLoading: isProjectLoading } = useQuery({
    queryKey: ["project_detail", currentOrgId, projectId],
    queryFn: () => projectApi.get(currentOrgId!, projectId),
    enabled: Boolean(currentOrgId && projectId),
  })

  // 2. Fetch or Initiate Verification Challenge
  const { data: verifyRes, isLoading: isVerifyLoading, refetch: refetchVerification } = useQuery({
    queryKey: ["project_verification", currentOrgId, projectId],
    queryFn: async () => {
      try {
        const existing = await projectApi.getVerificationStatus(currentOrgId!, projectId)
        if (existing.data?.token) return existing
      } catch {
        // If not initiated yet, call initiate
      }
      return projectApi.initiateVerification(currentOrgId!, projectId, method)
    },
    enabled: Boolean(currentOrgId && projectId),
  })

  // 3. Check Verification Mutation
  const checkMutation = useMutation({
    mutationFn: () => projectApi.checkVerification(currentOrgId!, projectId),
    onSuccess: (res) => {
      setCheckResult({
        status: res.data?.status || "pending",
        reason: res.data?.reason,
      })
      queryClient.invalidateQueries({ queryKey: ["project_detail", currentOrgId, projectId] })
      queryClient.invalidateQueries({ queryKey: ["project_verification", currentOrgId, projectId] })
    },
    onError: (err: unknown) => {
      setCheckResult({
        status: "failed",
        reason: err instanceof Error ? err.message : "Verification check failed",
      })
    },
  })

  const project = projectRes?.data
  const verifyData = verifyRes?.data
  const isVerified = project?.verification_status === "verified" || checkResult?.status === "verified"

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Target Domain Verification"
        description="Verify ownership of your target API domain to unlock distributed, high-throughput load tests."
        breadcrumbs={[
          { label: "Projects", href: "/dashboard/projects" },
          { label: project?.name || "Target", href: `/dashboard/projects/${projectId}` },
          { label: "Verification" },
        ]}
        actions={
          isVerified ? (
            <Button
              onClick={() => router.push(`/dashboard/runner?project=${projectId}`)}
              className="gap-2 bg-brand text-white hover:bg-brand-hover text-xs font-mono"
            >
              <Play className="size-3.5 fill-current" />
              <span>Launch Test Run</span>
            </Button>
          ) : undefined
        }
      />

      {isProjectLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-6">
          {/* Target Summary Card */}
          <Card className="border-border bg-surface">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-heading font-bold text-lg text-foreground">
                    {project?.name}
                  </span>
                  <StatusBadge
                    status={isVerified ? "completed" : "pending"}
                    label={isVerified ? "VERIFIED" : "UNVERIFIED"}
                  />
                  <span className="rounded bg-surface-raised px-2 py-0.5 font-mono text-[10px] uppercase text-sand border border-border-subtle">
                    {project?.environment}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-foreground-muted">
                  <Globe className="size-3.5 text-foreground-subtle" />
                  <span className="text-foreground">{project?.base_url}</span>
                </div>
              </div>

              {isVerified && (
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2 text-xs font-mono text-success">
                  <ShieldCheck className="size-4" />
                  <span>Verified & Authorized for Distributed Generation</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verification Workspace */}
          {isVerified ? (
            <Card className="border-success/30 bg-surface">
              <CardContent className="p-8 text-center space-y-4">
                <div className="size-12 rounded-full bg-success/10 border border-success/30 text-success mx-auto flex items-center justify-center">
                  <ShieldCheck className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading font-bold text-lg text-foreground">
                    Domain Ownership Confirmed
                  </h3>
                  <p className="text-xs text-foreground-muted font-mono max-w-md mx-auto">
                    Your target domain has been cryptographically verified. You can now execute multi-region load profiles and tail latency benchmarks.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button
                    onClick={() => router.push(`/dashboard/projects/${projectId}/endpoints`)}
                    variant="outline"
                    className="text-xs font-mono gap-1.5"
                  >
                    <span>Register Endpoints</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                  <Button
                    onClick={() => router.push(`/dashboard/runner?project=${projectId}`)}
                    className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                  >
                    <Play className="size-3.5 fill-current" />
                    <span>Run First Load Test</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left 2 Cols: DNS Instructions */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border bg-surface">
                  <CardHeader className="border-b border-border-subtle pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold font-heading text-foreground">
                          Verification Instructions
                        </CardTitle>
                        <CardDescription className="text-xs text-foreground-muted font-mono">
                          Add the following DNS TXT challenge to confirm target authority.
                        </CardDescription>
                      </div>

                      {/* Method Selector */}
                      <div className="inline-flex rounded-md border border-border-subtle bg-surface-raised p-0.5 font-mono text-xs">
                        <button
                          onClick={() => setMethod("dns")}
                          className={`rounded px-2.5 py-1 transition-colors ${
                            method === "dns" ? "bg-brand text-white font-medium" : "text-foreground-muted hover:text-foreground"
                          }`}
                        >
                          DNS TXT
                        </button>
                        <button
                          onClick={() => setMethod("file")}
                          className={`rounded px-2.5 py-1 transition-colors ${
                            method === "file" ? "bg-brand text-white font-medium" : "text-foreground-muted hover:text-foreground"
                          }`}
                        >
                          HTTP File
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6 space-y-5">
                    {isVerifyLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : method === "dns" ? (
                      <div className="space-y-4">
                        {/* Record Type */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-mono text-foreground-subtle uppercase">
                            Record Type
                          </span>
                          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs">
                            <span className="font-bold text-sand">TXT</span>
                            <button
                              onClick={() => copyToClipboard("TXT", "type")}
                              className="text-foreground-subtle hover:text-foreground transition-colors"
                            >
                              {copiedField === "type" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Host / Name */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-mono text-foreground-subtle uppercase">
                            Host / Name
                          </span>
                          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs">
                            <span className="text-foreground truncate mr-2">
                              {verifyData?.instructions?.dns?.host || `_strim-challenge.${project?.base_url ? new URL(project.base_url).hostname : "domain"}`}
                            </span>
                            <button
                              onClick={() => copyToClipboard(verifyData?.instructions?.dns?.host || "", "host")}
                              className="text-foreground-subtle hover:text-foreground transition-colors shrink-0"
                            >
                              {copiedField === "host" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* TXT Value */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-mono text-foreground-subtle uppercase">
                            Record Value / Token
                          </span>
                          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs">
                            <span className="text-sand truncate mr-2">
                              {verifyData?.instructions?.dns?.value || `strim-verify=${verifyData?.token || "generating..."}`}
                            </span>
                            <button
                              onClick={() => copyToClipboard(verifyData?.instructions?.dns?.value || "", "value")}
                              className="text-foreground-subtle hover:text-foreground transition-colors shrink-0"
                            >
                              {copiedField === "value" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-mono text-foreground-subtle uppercase">
                            Well-Known URL Path
                          </span>
                          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs">
                            <span className="text-foreground truncate mr-2">
                              {verifyData?.instructions?.file?.url || `${project?.base_url}/.well-known/strim-verify.txt`}
                            </span>
                            <button
                              onClick={() => copyToClipboard(verifyData?.instructions?.file?.url || "", "url")}
                              className="text-foreground-subtle hover:text-foreground transition-colors shrink-0"
                            >
                              {copiedField === "url" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[11px] font-mono text-foreground-subtle uppercase">
                            Required File Content
                          </span>
                          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs">
                            <span className="text-sand truncate mr-2">
                              {verifyData?.instructions?.file?.content || verifyData?.token}
                            </span>
                            <button
                              onClick={() => copyToClipboard(verifyData?.instructions?.file?.content || "", "content")}
                              className="text-foreground-subtle hover:text-foreground transition-colors shrink-0"
                            >
                              {copiedField === "content" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Result alert if check executed */}
                    {checkResult && (
                      <div
                        className={`rounded-lg border p-3.5 text-xs font-mono flex items-start gap-2.5 ${
                          checkResult.status === "verified"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-warning/30 bg-warning/10 text-warning"
                        }`}
                      >
                        {checkResult.status === "verified" ? (
                          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
                        ) : (
                          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold uppercase">
                            Status: {checkResult.status}
                          </p>
                          {checkResult.reason && (
                            <p className="mt-1 text-[11px] opacity-90">{checkResult.reason}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Check Action Button */}
                    <div className="pt-2 flex items-center justify-between">
                      <Button
                        onClick={() => checkMutation.mutate()}
                        disabled={checkMutation.isPending}
                        className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-2"
                      >
                        {checkMutation.isPending ? (
                          <>
                            <RefreshCw className="size-3.5 animate-spin" />
                            <span>Probing DNS Records...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="size-3.5" />
                            <span>Verify Target DNS Now</span>
                          </>
                        )}
                      </Button>

                      <button
                        onClick={() => refetchVerification()}
                        className="text-xs font-mono text-foreground-subtle hover:text-foreground"
                      >
                        Regenerate Token
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Col: Netguard SSRF Policy Card */}
              <div className="space-y-6">
                <Card className="border-border bg-surface">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold font-heading text-foreground">
                      Why Verification is Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 font-mono text-xs text-foreground-muted">
                    <p className="leading-relaxed">
                      STRIM Labs executes high-concurrency synthetic load generators. To prevent accidental disruption or abusive distributed denial-of-service, all targets require proof of ownership.
                    </p>
                    <div className="rounded-lg border border-border-subtle bg-surface-raised/40 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-sand">Netguard Protections:</p>
                      <ul className="list-disc list-inside text-[10px] space-y-1 text-foreground-subtle">
                        <li>Blocks private IP ranges (RFC 1918)</li>
                        <li>Blocks cloud metadata endpoints (169.254.169.254)</li>
                        <li>Enforces DNS TTL cache pinning</li>
                        <li>Instant killswitch on 5xx saturation</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
