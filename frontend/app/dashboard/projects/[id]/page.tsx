"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import Link from "next/link"
import { Play, GitCompare, ShieldAlert } from "lucide-react"

import { projectApi } from "@/lib/project-api"
import { loadtestApi, type CompareResponse } from "@/lib/loadtest-api"
import { endpointApi } from "@/lib/endpoint-api"
import { metricsApi } from "@/lib/metrics-api"
import { useUIStore } from "@/lib/stores/ui-store"

import {
  ProjectHeaderCard,
  type ProjectDashboardTab,
} from "@/components/projects/project-header-card"
import { ProjectTrafficMetrics } from "@/components/projects/project-traffic-metrics"
import { ProjectRecentRunsTable } from "@/components/projects/project-recent-runs-table"
import { ProjectEndpointsPreview } from "@/components/projects/project-endpoints-preview"
import { ProjectDiscoveryGuide } from "@/components/projects/project-discovery-guide"
import { ProjectVerificationPanel } from "@/components/projects/project-verification-panel"
import { ProjectDangerZone } from "@/components/projects/project-danger-zone"
import { ProjectCompareModal } from "@/components/projects/project-compare-modal"

export default function DedicatedProjectDashboard() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentOrgId, setCurrentProjectId } = useUIStore()

  const projectId = (params?.id as string) || ""

  // Active Tab for verified cockpit
  const [activeTab, setActiveTab] = React.useState<ProjectDashboardTab>("overview")

  // Verification State
  const [verifyStatus, setVerifyStatus] = React.useState<{ success: boolean; message: string } | null>(null)

  // Compare Runs Modal State
  const [isCompareOpen, setIsCompareOpen] = React.useState(false)
  const [baselineRunId, setBaselineRunId] = React.useState<string>("")
  const [candidateRunId, setCandidateRunId] = React.useState<string>("")
  const [compareData, setCompareData] = React.useState<CompareResponse | null>(null)
  const [isComparing, setIsComparing] = React.useState(false)
  const [compareError, setCompareError] = React.useState<string | null>(null)

  // Discovery Spec State
  const [discoverySpecUrl, setDiscoverySpecUrl] = React.useState("")
  const [discoveryResult, setDiscoveryResult] = React.useState<string | null>(null)
  const [discoveryError, setDiscoveryError] = React.useState<string | null>(null)

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = React.useState("")
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // 1. Fetch Project Details
  const { data: projectRes, isLoading: isProjectLoading } = useQuery({
    queryKey: ["project_detail", currentOrgId, projectId],
    queryFn: () => projectApi.get(currentOrgId!, projectId),
    enabled: Boolean(currentOrgId && projectId),
  })

  const project = projectRes?.data
  const isVerified = project?.verification_status === "verified"

  React.useEffect(() => {
    if (projectId) {
      setCurrentProjectId(projectId)
    }
  }, [projectId, setCurrentProjectId])

  // 2. Fetch Verification Challenge if needed
  const { data: verifyRes } = useQuery({
    queryKey: ["project_verification", currentOrgId, projectId],
    queryFn: async () => {
      try {
        const existing = await projectApi.getVerificationStatus(currentOrgId!, projectId)
        if (existing.data?.token) return existing
      } catch {}
      return projectApi.initiateVerification(currentOrgId!, projectId, "file")
    },
    enabled: Boolean(currentOrgId && projectId && !isVerified),
  })

  const verifyToken = verifyRes?.data?.token
    ? verifyRes.data.token.replace(/^strim-verify=/, "")
    : "strim-verify-token"

  // 3. Fetch Recent Runs (only enabled once verified)
  const { data: testsRes, isLoading: isTestsLoading } = useQuery({
    queryKey: ["load_tests_list", currentOrgId, projectId],
    queryFn: () => loadtestApi.list(currentOrgId!, projectId),
    enabled: Boolean(currentOrgId && projectId && isVerified),
    refetchInterval: isVerified ? 6000 : false,
  })

  const tests = testsRes?.data || []
  const completedTests = tests.filter((t) => t.status === "completed" || t.status === "stopped")

  // 4. Fetch Endpoints List (only enabled once verified)
  const { data: endpointsRes, isLoading: isEndpointsLoading } = useQuery({
    queryKey: ["endpoints_list", currentOrgId, projectId],
    queryFn: () => endpointApi.list(currentOrgId!, projectId),
    enabled: Boolean(currentOrgId && projectId && isVerified),
  })

  const endpoints = endpointsRes?.data || []

  // 5. Fetch Status Codes Distribution (only enabled once verified)
  const { data: statusCodesRes } = useQuery({
    queryKey: ["metrics_status_codes", currentOrgId, projectId],
    queryFn: () => metricsApi.getStatusCodes(currentOrgId!, projectId, "1h"),
    enabled: Boolean(currentOrgId && projectId && isVerified),
    refetchInterval: isVerified ? 10000 : false,
  })

  const statusCodes = statusCodesRes?.data
  const codeClasses = statusCodes?.classes || { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 }
  const totalCodes =
    (codeClasses["2xx"] || 0) +
    (codeClasses["3xx"] || 0) +
    (codeClasses["4xx"] || 0) +
    (codeClasses["5xx"] || 0)

  const pct2xx = totalCodes > 0 ? ((codeClasses["2xx"] || 0) / totalCodes) * 100 : 100
  const pct3xx = totalCodes > 0 ? ((codeClasses["3xx"] || 0) / totalCodes) * 100 : 0
  const pct4xx = totalCodes > 0 ? ((codeClasses["4xx"] || 0) / totalCodes) * 100 : 0
  const pct5xx = totalCodes > 0 ? ((codeClasses["5xx"] || 0) / totalCodes) * 100 : 0

  // 6. Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: () => projectApi.checkVerification(currentOrgId!, projectId),
    onSuccess: (res) => {
      if (res.data?.status === "verified") {
        setVerifyStatus({
          success: true,
          message: "Domain verified successfully! Project cockpit is now unlocked.",
        })
        // Optimistically update query data to unlock immediately
        queryClient.setQueryData(["project_detail", currentOrgId, projectId], (old: { data?: typeof project } | undefined) => {
          if (!old?.data) return old
          return {
            ...old,
            data: {
              ...old.data,
              verification_status: "verified",
            },
          }
        })
        queryClient.invalidateQueries({ queryKey: ["project_detail", currentOrgId, projectId] })
        queryClient.invalidateQueries({ queryKey: ["projects_list", currentOrgId] })
        queryClient.invalidateQueries({ queryKey: ["load_tests_list", currentOrgId, projectId] })
        queryClient.invalidateQueries({ queryKey: ["endpoints_list", currentOrgId, projectId] })
        queryClient.invalidateQueries({ queryKey: ["metrics_status_codes", currentOrgId, projectId] })
        setActiveTab("overview")
      } else {
        setVerifyStatus({
          success: false,
          message: res.data?.reason || "Verification check failed. Ensure the verification token is deployed.",
        })
      }
    },
    onError: (err: unknown) => {
      setVerifyStatus({
        success: false,
        message: err instanceof Error ? err.message : "Failed to run verification check.",
      })
    },
  })

  // 7. Discovery Mutation
  const discoveryMutation = useMutation({
    mutationFn: (url: string) => endpointApi.importOpenAPI(currentOrgId!, projectId, { url }),
    onSuccess: (res) => {
      setDiscoveryError(null)
      setDiscoveryResult(
        `Discovery finished: ${res.data?.found || 0} routes indexed, ${res.data?.created || 0} newly registered.`
      )
      queryClient.invalidateQueries({ queryKey: ["endpoints_list", currentOrgId, projectId] })
      queryClient.invalidateQueries({ queryKey: ["project_detail", currentOrgId, projectId] })
      setDiscoverySpecUrl("")
    },
    onError: (err: unknown) => {
      setDiscoveryError(err instanceof Error ? err.message : "Failed to parse API specification.")
    },
  })

  // 8. Run Comparison Handler
  const handleRunComparison = async () => {
    if (!baselineRunId || !candidateRunId) {
      setCompareError("Please select both a baseline and a comparison test run.")
      return
    }
    if (baselineRunId === candidateRunId) {
      setCompareError("Please choose two different test runs to compare.")
      return
    }

    try {
      setIsComparing(true)
      setCompareError(null)
      const res = await loadtestApi.compare(currentOrgId!, projectId, {
        baseline_id: baselineRunId,
        test_ids: [baselineRunId, candidateRunId],
      })
      setCompareData(res.data)
    } catch (err: unknown) {
      // Fallback to local computation from test list if backend endpoint returns standard run objects
      const runA = tests.find((t) => t.id === baselineRunId)
      const runB = tests.find((t) => t.id === candidateRunId)

      if (runA && runB) {
        const rpsA = runA.summary?.achieved_avg_rps || 0
        const rpsB = runB.summary?.achieved_avg_rps || 0
        const p95A = runA.summary?.p95_ms || 0
        const p95B = runB.summary?.p95_ms || 0
        const errA = runA.summary?.error_rate || 0
        const errB = runB.summary?.error_rate || 0

        const rpsDeltaPct = rpsA > 0 ? ((rpsB - rpsA) / rpsA) * 100 : 0
        const p95DeltaPct = p95A > 0 ? ((p95B - p95A) / p95A) * 100 : 0
        const errDeltaPct = errB - errA

        const verdict = p95B < p95A && errB <= errA ? "improved" : p95B > p95A * 1.15 ? "regressed" : "unchanged"

        setCompareData({
          baseline_id: runA.id,
          tests: [
            {
              id: runA.id,
              name: runA.name,
              avg_rps: rpsA,
              peak_rps: runA.summary?.peak_achieved_rps || rpsA,
              p95_ms: p95A,
              error_rate: errA,
            },
            {
              id: runB.id,
              name: runB.name,
              avg_rps: rpsB,
              peak_rps: runB.summary?.peak_achieved_rps || rpsB,
              p95_ms: p95B,
              error_rate: errB,
            },
          ],
          deltas: [
            {
              test_id: runB.id,
              avg_rps_pct: rpsDeltaPct,
              peak_rps_pct: 0,
              p95_pct: p95DeltaPct,
              error_rate_pct: errDeltaPct,
              verdict,
            },
          ],
          overlay: {
            step: "1s",
            series: [],
          },
        })
      } else {
        setCompareError(err instanceof Error ? err.message : "Failed to run comparison.")
      }
    } finally {
      setIsComparing(false)
    }
  }

  // 9. Delete Project Handler
  const handleDelete = async () => {
    if (!currentOrgId || !project) return
    if (deleteConfirm !== project.slug) {
      setDeleteError(`Please type "${project.slug}" to confirm deletion.`)
      return
    }
    try {
      setIsDeleting(true)
      setDeleteError(null)
      await projectApi.delete(currentOrgId, projectId)
      queryClient.invalidateQueries({ queryKey: ["projects_list", currentOrgId] })
      router.push("/dashboard/projects")
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete project.")
    } finally {
      setIsDeleting(false)
    }
  }

  const latestCompleted = completedTests[0]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={project?.name || "Project Cockpit"}
        description={
          isVerified
            ? "Target service configuration, active performance telemetry, and load test management."
            : "Domain verification required. Verify ownership to unlock the project cockpit."
        }
        breadcrumbs={[
          { label: "Projects", href: "/dashboard/projects" },
          { label: project?.name || "Cockpit" },
          ...(!isVerified ? [{ label: "Verification" }] : []),
        ]}
        actions={
          isVerified ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (completedTests.length >= 2) {
                    setBaselineRunId(completedTests[1].id)
                    setCandidateRunId(completedTests[0].id)
                  } else if (completedTests.length === 1) {
                    setBaselineRunId(completedTests[0].id)
                  }
                  setIsCompareOpen(true)
                }}
                className="gap-1.5 font-mono text-xs border-border-subtle bg-surface-raised hover:bg-surface text-sand"
              >
                <GitCompare className="size-3.5 text-brand" />
                <span>Compare Runs</span>
              </Button>

              <Link
                href={`/dashboard/runner?project=${projectId}`}
                className={buttonVariants({
                  size: "sm",
                  className: "gap-1.5 bg-brand text-white hover:bg-brand-hover text-xs font-mono font-medium shadow-md",
                })}
              >
                <Play className="size-3.5 fill-current" />
                <span>Launch Load Test</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <StatusBadge status="pending" label="VERIFICATION REQUIRED" />
            </div>
          )
        }
      />

      {isProjectLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      ) : !project ? (
        <Card className="p-8 text-center border-border bg-surface">
          <p className="font-mono text-xs text-foreground-muted">Project not found or accessible.</p>
        </Card>
      ) : !isVerified ? (
        /* STRICT VERIFICATION GATE: If project is not verified, user cannot access project cockpit */
        <div className="space-y-6">
          {/* Access Locked Banner */}
          <div className="relative rounded-xl border border-border bg-surface p-6 shadow-xs overflow-hidden">
            <CornerCrosshairs />
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <ShieldAlert className="size-4" />
                  </div>
                  <span className="font-mono text-xs text-amber-400 font-semibold uppercase tracking-wider">
                    Access Gated • Domain Verification Required
                  </span>
                </div>
                <h2 className="text-xl font-bold font-heading text-foreground tracking-tight">
                  Verify ownership of {project.base_url} to access Cockpit
                </h2>
                <p className="text-xs text-foreground-muted font-mono leading-relaxed">
                  To protect target infrastructure and comply with traffic policies, you must verify domain authority for <strong className="text-foreground">{project.base_url}</strong> before accessing the project cockpit, telemetry feeds, API discovery, or launching distributed load tests.
                </p>
              </div>

              {/* 3-Step Verification Checklist */}
              <div className="w-full lg:w-auto p-4 rounded-xl border border-border-subtle bg-surface-raised/40 space-y-2.5 font-mono text-xs min-w-[280px]">
                <span className="text-foreground-subtle text-[11px] uppercase tracking-wider block font-semibold">
                  3-Step Verification
                </span>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="size-4 rounded-full bg-brand/20 text-brand text-[10px] flex items-center justify-center font-bold">1</span>
                    <span>Select framework (Next.js, Node, etc.)</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="size-4 rounded-full bg-brand/20 text-brand text-[10px] flex items-center justify-center font-bold">2</span>
                    <span>Deploy verification token route</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="size-4 rounded-full bg-brand/20 text-brand text-[10px] flex items-center justify-center font-bold">3</span>
                    <span>Run check to unlock the cockpit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Verification Panel */}
          <ProjectVerificationPanel
            project={project}
            isVerified={isVerified}
            verifyToken={verifyToken}
            verifyStatus={verifyStatus}
            onVerify={() => verifyMutation.mutate()}
            isVerifying={verifyMutation.isPending}
          />

          {/* Fallback Option: Project Deletion if entered wrong base_url */}
          <div className="rounded-xl border border-border-subtle bg-surface/50 p-4 font-mono text-xs">
            <details className="group">
              <summary className="cursor-pointer text-foreground-subtle hover:text-foreground list-none flex items-center justify-between">
                <span>Entered an incorrect base URL or wish to delete this project?</span>
                <span className="text-xs text-brand group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="pt-4 mt-3 border-t border-border-subtle">
                <ProjectDangerZone
                  projectSlug={project.slug}
                  deleteConfirm={deleteConfirm}
                  setDeleteConfirm={setDeleteConfirm}
                  onDelete={handleDelete}
                  isDeleting={isDeleting}
                  deleteError={deleteError}
                />
              </div>
            </details>
          </div>
        </div>
      ) : (
        /* FULL PROJECT COCKPIT (Only visible when verified) */
        <div className="space-y-6">
          {/* Main Context Card & Route Shortcuts */}
          <ProjectHeaderCard
            project={project}
            isVerified={isVerified}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenCompare={() => {
              if (completedTests.length >= 2) {
                setBaselineRunId(completedTests[1].id)
                setCandidateRunId(completedTests[0].id)
              } else if (completedTests.length === 1) {
                setBaselineRunId(completedTests[0].id)
              }
              setIsCompareOpen(true)
            }}
            testsCount={tests.length}
            endpointsCount={endpoints.length}
          />

          {/* Tab 1: Cockpit Overview */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <ProjectTrafficMetrics
                project={project}
                codeClasses={codeClasses}
                totalCodes={totalCodes}
                pct2xx={pct2xx}
                pct3xx={pct3xx}
                pct4xx={pct4xx}
                pct5xx={pct5xx}
                latestCompletedTest={latestCompleted}
                endpointsCount={endpoints.length}
                projectId={projectId}
              />

              <ProjectRecentRunsTable
                tests={tests}
                isLoading={isTestsLoading}
                projectId={projectId}
              />

              <ProjectEndpointsPreview
                endpoints={endpoints}
                isLoading={isEndpointsLoading}
                projectId={projectId}
                onOpenDiscovery={() => setActiveTab("discovery")}
              />
            </div>
          )}

          {/* Tab 2: Explicit API Discovery Guide */}
          {activeTab === "discovery" && (
            <ProjectDiscoveryGuide
              project={project}
              discoverySpecUrl={discoverySpecUrl}
              setDiscoverySpecUrl={setDiscoverySpecUrl}
              onScanSpec={(url) => discoveryMutation.mutate(url)}
              isScanning={discoveryMutation.isPending}
              discoveryResult={discoveryResult}
              discoveryError={discoveryError}
              endpointsCount={endpoints.length}
            />
          )}

          {/* Tab 3: Verification Setup */}
          {activeTab === "verification" && (
            <ProjectVerificationPanel
              project={project}
              isVerified={isVerified}
              verifyToken={verifyToken}
              verifyStatus={verifyStatus}
              onVerify={() => verifyMutation.mutate()}
              isVerifying={verifyMutation.isPending}
            />
          )}

          {/* Tab 4: Settings & Danger Zone */}
          {activeTab === "settings" && (
            <ProjectDangerZone
              projectSlug={project.slug}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
              onDelete={handleDelete}
              isDeleting={isDeleting}
              deleteError={deleteError}
            />
          )}
        </div>
      )}

      {/* Interactive Compare Runs Modal */}
      <ProjectCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        projectName={project?.name || "Project"}
        tests={tests}
        baselineRunId={baselineRunId}
        setBaselineRunId={setBaselineRunId}
        candidateRunId={candidateRunId}
        setCandidateRunId={setCandidateRunId}
        compareData={compareData}
        isComparing={isComparing}
        compareError={compareError}
        onRunComparison={handleRunComparison}
      />
    </div>
  )
}
