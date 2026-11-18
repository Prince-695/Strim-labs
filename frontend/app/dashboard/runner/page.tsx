"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  Play,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Server,
  Globe,
  Layers,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { projectApi } from "@/lib/project-api"
import { endpointApi } from "@/lib/endpoint-api"
import {
  loadtestApi,
  type LoadTestProfile,
  type LoadTestModel,
} from "@/lib/loadtest-api"
import { useUIStore } from "@/lib/stores/ui-store"

const PRESETS: {
  id: LoadTestProfile
  title: string
  subtitle: string
  desc: string
  defaultRamp: number
  defaultDuration: number
  defaultPeak: number
  defaultVUs: number
}[] = [
  {
    id: "ramp",
    title: "Progressive Ramp-Up",
    subtitle: "Capacity & Knee Discovery",
    desc: "Linearly climbs from base to peak concurrency to locate latency inflection knees and breaking points.",
    defaultRamp: 60,
    defaultDuration: 180,
    defaultPeak: 200,
    defaultVUs: 50,
  },
  {
    id: "sustained",
    title: "Constant Throughput",
    subtitle: "Steady-State Baseline",
    desc: "Holds a fixed target RPS to evaluate latency consistency, tail distributions, and baseline predictability.",
    defaultRamp: 10,
    defaultDuration: 120,
    defaultPeak: 100,
    defaultVUs: 25,
  },
  {
    id: "spike",
    title: "Traffic Burst Spike",
    subtitle: "Autoscaling & Resilience",
    desc: "Simulates an instant 10x traffic spike to verify autoscaling velocity, cache buffers, and rate limits.",
    defaultRamp: 5,
    defaultDuration: 60,
    defaultPeak: 400,
    defaultVUs: 100,
  },
  {
    id: "step",
    title: "Step Ladder",
    subtitle: "Gradual Load Tiers",
    desc: "Ascends concurrency in distinct step intervals to measure system degradation per load bracket.",
    defaultRamp: 30,
    defaultDuration: 240,
    defaultPeak: 300,
    defaultVUs: 75,
  },
]

function generateDefaultTestName(projectName?: string, testProfile?: string) {
  const pName = projectName || "API Target"
  const prof = (testProfile || "ramp").toUpperCase()
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  return `${pName} • ${prof} • ${timeStr}`
}

function RunnerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrgId, currentProjectId, setProjectId } = useUIStore()

  const projectParam = searchParams.get("project")
  const activeProjectId = projectParam || currentProjectId || ""

  // State
  const [testScope, setTestScope] = React.useState<"full_server" | "single">(
    "full_server"
  )
  const [safeOnly, setSafeOnly] = React.useState(true)
  const [customTestName, setCustomTestName] = React.useState<string | null>(
    null
  )
  const [profile, setProfile] = React.useState<LoadTestProfile>("ramp")
  const [model, setModel] = React.useState<LoadTestModel>("open")
  const [targetMethod, setTargetMethod] = React.useState("GET")
  const [targetPath, setTargetPath] = React.useState("/")
  const [targetBody, setTargetBody] = React.useState("")
  const [selectedEndpointId, setSelectedEndpointId] = React.useState<string>("")
  const [peakRate, setPeakRate] = React.useState(150)
  const [startRate, setStartRate] = React.useState(10)
  const [durationSeconds, setDurationSeconds] = React.useState(120)
  const [rampUpSeconds, setRampUpSeconds] = React.useState(30)
  const [maxVUs, setMaxVUs] = React.useState(50)
  const [timeoutMs, setTimeoutMs] = React.useState(5000)
  const [maxP95Ms, setMaxP95Ms] = React.useState(400)
  const [maxErrorRate, setMaxErrorRate] = React.useState(0.05)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // 1. Fetch Projects
  const { data: projectsRes } = useQuery({
    queryKey: ["projects_list", currentOrgId],
    queryFn: () => projectApi.list(currentOrgId!),
    enabled: Boolean(currentOrgId),
  })

  // 2. Fetch Active Project details
  const { data: projectDetailRes } = useQuery({
    queryKey: ["project_detail", currentOrgId, activeProjectId],
    queryFn: () => projectApi.get(currentOrgId!, activeProjectId),
    enabled: Boolean(currentOrgId && activeProjectId),
  })

  // 3. Fetch Registered Endpoints
  const { data: endpointsRes } = useQuery({
    queryKey: ["endpoints_list", currentOrgId, activeProjectId],
    queryFn: () => endpointApi.list(currentOrgId!, activeProjectId),
    enabled: Boolean(currentOrgId && activeProjectId),
  })

  const projects = projectsRes?.data || []
  const activeProject =
    projectDetailRes?.data || projects.find((p) => p.id === activeProjectId)
  const endpoints = endpointsRes?.data || []
  const isVerified = activeProject?.verification_status === "verified"

  // Automatically derive default test run name from project and profile unless user customized it
  const defaultTestName = React.useMemo(
    () => generateDefaultTestName(activeProject?.name, profile),
    [activeProject?.name, profile]
  )
  const testName = customTestName !== null ? customTestName : defaultTestName

  // Sync endpoint selection
  const handleEndpointSelect = (endpointId: string) => {
    setSelectedEndpointId(endpointId)
    const found = endpoints.find((e) => e.id === endpointId)
    if (found) {
      setTargetMethod(found.method.toUpperCase())
      setTargetPath(found.path_template)
    }
  }

  // Preset Selection
  const applyPreset = (presetId: LoadTestProfile) => {
    setProfile(presetId)
    const p = PRESETS.find((x) => x.id === presetId)
    if (p) {
      setRampUpSeconds(p.defaultRamp)
      setDurationSeconds(p.defaultDuration)
      setPeakRate(p.defaultPeak)
      setMaxVUs(p.defaultVUs)
    }
  }

  // Launch Mutation
  const launchMutation = useMutation({
    mutationFn: () => {
      if (!currentOrgId || !activeProjectId) {
        throw new Error("Missing organization or project selection")
      }
      const isFullServer = testScope === "full_server"

      return loadtestApi.create(currentOrgId, activeProjectId, {
        name: testName,
        model,
        profile,
        all_endpoints: isFullServer,
        safe_only: isFullServer ? safeOnly : undefined,
        targets: isFullServer
          ? []
          : [
              {
                endpoint_id: selectedEndpointId || undefined,
                method: targetMethod,
                path: targetPath,
                body: targetBody ? targetBody : undefined,
                weight: 1,
              },
            ],
        start_rate: startRate,
        peak_rate: peakRate,
        ramp_up_seconds: rampUpSeconds,
        duration_seconds: durationSeconds,
        max_virtual_users: maxVUs,
        timeout_ms: timeoutMs,
        capacity_thresholds: {
          max_p95_ms: maxP95Ms,
          max_error_rate: maxErrorRate,
        },
        start_now: true,
      })
    },
    onSuccess: (res) => {
      if (res.data?.id) {
        router.push(`/dashboard/runs/${res.data.id}`)
      } else {
        router.push("/dashboard/runs")
      }
    },
    onError: (err: unknown) => {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to launch load test."
      )
    },
  })

  // Estimated Total Requests
  const estimatedRequests = React.useMemo(() => {
    if (profile === "sustained") {
      return peakRate * durationSeconds
    }
    // Ramp up calculation: average of start and peak during ramp + peak for remainder
    const rampRequests =
      ((startRate + peakRate) / 2) * Math.min(rampUpSeconds, durationSeconds)
    const steadyDuration = Math.max(0, durationSeconds - rampUpSeconds)
    const steadyRequests = peakRate * steadyDuration
    return Math.round(rampRequests + steadyRequests)
  }, [profile, peakRate, startRate, durationSeconds, rampUpSeconds])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Load Test Runner"
        description="Configure and execute synthetic workload tests to benchmark API latency and throughput limits."
        breadcrumbs={[
          { label: "Runner" },
          { label: activeProject?.name || "Target" },
        ]}
      />

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3.5 font-mono text-xs text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Target & Verification Context Banner */}
      <Card className="relative overflow-hidden border-border bg-surface">
        <CornerCrosshairs />
        <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-foreground-subtle uppercase">
              Target Project:
            </span>
            <select
              value={activeProjectId}
              onChange={(e) => {
                const newId = e.target.value
                setProjectId(newId)
                router.replace(`/dashboard/runner?project=${newId}`)
              }}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.environment})
                </option>
              ))}
            </select>

            {activeProject && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-foreground-muted">
                  Base URL:{" "}
                  <strong className="text-foreground">
                    {activeProject.base_url}
                  </strong>
                </span>
                <StatusBadge
                  status={isVerified ? "completed" : "pending"}
                  label={isVerified ? "DOMAIN VERIFIED" : "UNVERIFIED"}
                />
              </div>
            )}
          </div>

          {!isVerified && activeProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/projects/${activeProject.id}`)
              }
              className="shrink-0 gap-1.5 border-warning/40 font-mono text-xs text-warning"
            >
              <ShieldAlert className="size-3.5" />
              <span>Verify Target to Unlock Full Scale</span>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Main Runner Config Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Preset Selection & Configuration */}
        <div className="space-y-6 lg:col-span-2">
          {/* Preset Cards */}
          <div className="space-y-3">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              1. Select Workload Profile Preset
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {PRESETS.map((p) => {
                const isSelected = profile === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`cursor-pointer space-y-2 rounded-xl border p-4 transition-all duration-200 ${
                      isSelected
                        ? "border-brand bg-brand/5 shadow-md"
                        : "border-border bg-surface hover:border-border-subtle hover:bg-surface-raised/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-sm font-bold text-foreground">
                        {p.title}
                      </span>
                      {isSelected ? (
                        <span className="size-2 rounded-full bg-brand" />
                      ) : (
                        <span className="size-2 rounded-full bg-border-subtle" />
                      )}
                    </div>
                    <span className="inline-block font-mono text-[10px] text-sand uppercase">
                      {p.subtitle}
                    </span>
                    <p className="text-xs leading-relaxed text-foreground-muted">
                      {p.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Test Parameters */}
          <Card className="border-border bg-surface">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="font-heading text-sm font-semibold text-foreground">
                2. Execution & Concurrency Parameters
              </CardTitle>
              <CardDescription className="font-mono text-xs text-foreground-muted">
                Define the rate curve, virtual users limit, and duration bounds.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-6 font-mono text-xs">
              {/* Test Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-foreground-muted">
                    Test Run Name
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTestName(
                        generateDefaultTestName(activeProject?.name, profile)
                      )
                    }}
                    className="font-mono text-[11px] text-brand hover:underline"
                  >
                    Reset with Current Time
                  </button>
                </div>
                <Input
                  value={testName}
                  onChange={(e) => {
                    setCustomTestName(e.target.value)
                  }}
                  placeholder="e.g. Production API • RAMP • 14:30:00"
                  className="border-border-subtle bg-surface-raised font-mono text-xs"
                />
              </div>

              {/* Peak Rate & Start Rate Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-xs text-foreground-muted">
                      Peak Target (RPS)
                    </Label>
                    <span className="font-bold text-brand">{peakRate} RPS</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={1000}
                    step={10}
                    value={peakRate}
                    onChange={(e) => setPeakRate(Number(e.target.value))}
                    className="w-full cursor-pointer accent-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-xs text-foreground-muted">
                      Start Rate (RPS)
                    </Label>
                    <span className="font-bold text-foreground">
                      {startRate} RPS
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={5}
                    value={startRate}
                    onChange={(e) => setStartRate(Number(e.target.value))}
                    className="w-full cursor-pointer accent-sand"
                  />
                </div>
              </div>

              {/* Concurrency & Duration Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-xs text-foreground-muted">
                      Max Virtual Users (VUs)
                    </Label>
                    <span className="font-bold text-sand">{maxVUs} VUs</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={500}
                    step={5}
                    value={maxVUs}
                    onChange={(e) => setMaxVUs(Number(e.target.value))}
                    className="w-full cursor-pointer accent-sand"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-xs text-foreground-muted">
                      Total Duration
                    </Label>
                    <span className="font-bold text-foreground">
                      {durationSeconds}s (
                      {Math.round((durationSeconds / 60) * 10) / 10}m)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={900}
                    step={30}
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    className="w-full cursor-pointer accent-foreground"
                  />
                </div>
              </div>

              {/* Ramp Up Window */}
              {profile === "ramp" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-xs text-foreground-muted">
                      Ramp-Up Window
                    </Label>
                    <span className="font-bold text-sand">
                      {rampUpSeconds}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={Math.min(300, durationSeconds)}
                    step={10}
                    value={rampUpSeconds}
                    onChange={(e) => setRampUpSeconds(Number(e.target.value))}
                    className="w-full cursor-pointer accent-sand"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Target HTTP Request Configuration */}
          <Card className="border-border bg-surface">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle className="font-heading text-sm font-semibold text-foreground">
                    3. Target Scope & Endpoint Specification
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-foreground-muted">
                    Benchmark all discovered APIs simultaneously or target a
                    specific route.
                  </CardDescription>
                </div>

                {/* Feature 2: Test Scope Toggle */}
                <div className="inline-flex shrink-0 rounded-lg border border-border-subtle bg-surface-raised p-0.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setTestScope("full_server")}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
                      testScope === "full_server"
                        ? "bg-brand text-white shadow-xs"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <Layers className="size-3.5" />
                    <span>Full Server (All APIs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestScope("single")}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors ${
                      testScope === "single"
                        ? "bg-brand text-white shadow-xs"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <Server className="size-3.5" />
                    <span>Single / Custom Route</span>
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-6 font-mono text-xs">
              {testScope === "full_server" ? (
                /* Full Server Mode Options */
                <div className="space-y-4">
                  <div className="space-y-3 rounded-xl border border-border-subtle bg-surface-raised/40 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="size-4 text-brand" />
                        <span className="font-semibold text-foreground">
                          Distributed Server-Wide Assault
                        </span>
                      </div>
                      <span className="rounded border border-brand/20 bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                        {endpoints.length}{" "}
                        {endpoints.length === 1
                          ? "Discovered API"
                          : "Discovered APIs"}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-foreground-muted">
                      Strim Labs will distribute synthetic traffic across all
                      discovered endpoints for{" "}
                      <strong className="text-foreground">
                        {activeProject?.name || "this project"}
                      </strong>{" "}
                      ({activeProject?.base_url}) to measure aggregate capacity,
                      inflection points, and identify the weakest link.
                    </p>
                  </div>

                  {/* Safe Mode Checkbox */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised/60 p-4 transition-colors hover:border-border">
                    <input
                      type="checkbox"
                      checked={safeOnly}
                      onChange={(e) => setSafeOnly(e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-border-subtle text-brand accent-brand focus:ring-brand"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Safe Mode: Read-only (GET / HEAD only)
                        </span>
                        <span className="rounded border border-success/30 bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-foreground-muted">
                        Restricts synthetic traffic generation exclusively to
                        read-only idempotent endpoints. Automatically filters
                        out state-mutating requests (POST, PUT, DELETE, PATCH)
                        to safeguard production databases from unintended record
                        modifications.
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                /* Single / Custom Target Mode */
                <div className="space-y-4">
                  {/* Endpoint Preset Dropdown */}
                  {endpoints.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground-muted">
                        Choose Registered Endpoint
                      </Label>
                      <select
                        value={selectedEndpointId}
                        onChange={(e) => handleEndpointSelect(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
                      >
                        <option value="">-- Custom Target Request --</option>
                        {endpoints.map((ep) => (
                          <option key={ep.id} value={ep.id}>
                            [{ep.method.toUpperCase()}] {ep.path_template} (
                            {ep.service})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Method + Path Row */}
                  <div className="flex gap-2">
                    <select
                      value={targetMethod}
                      onChange={(e) => setTargetMethod(e.target.value)}
                      className="shrink-0 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs font-bold text-foreground focus:border-brand focus:outline-none"
                    >
                      {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>

                    <Input
                      placeholder="/orders/checkout"
                      value={targetPath}
                      onChange={(e) => setTargetPath(e.target.value)}
                      className="flex-1 border-border-subtle bg-surface-raised font-mono text-xs"
                    />
                  </div>

                  {/* Request Body (for POST/PUT) */}
                  {(targetMethod === "POST" ||
                    targetMethod === "PUT" ||
                    targetMethod === "PATCH") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-foreground-muted">
                        Request JSON Payload (Optional)
                      </Label>
                      <textarea
                        rows={4}
                        placeholder='{"sku": "prod-123", "qty": 1}'
                        value={targetBody}
                        onChange={(e) => setTargetBody(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-surface-raised p-2.5 font-mono text-xs text-foreground focus:border-brand focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Summary & Launch Action */}
        <div className="space-y-6">
          {/* Configuration Summary Card */}
          <Card className="border-border bg-surface">
            <CardHeader className="border-b border-border-subtle pb-3">
              <CardTitle className="font-heading text-sm font-semibold text-foreground">
                Run Configuration Summary
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 pt-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-border-subtle/40 py-1">
                <span className="text-foreground-subtle">Target Project</span>
                <span className="max-w-[170px] truncate font-semibold text-foreground">
                  {activeProject?.name || "None Selected"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border-subtle/40 py-1">
                <span className="text-foreground-subtle">Target Host</span>
                <span className="max-w-[150px] truncate font-medium text-foreground">
                  {activeProject?.base_url || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border-subtle/40 py-1">
                <span className="text-foreground-subtle">Target Scope</span>
                <span className="font-medium text-sand">
                  {testScope === "full_server"
                    ? `Full Server (${safeOnly ? "Safe Read-Only" : "All Methods"})`
                    : `${targetMethod} ${targetPath}`}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border-subtle/40 py-1">
                <span className="text-foreground-subtle">Profile Preset</span>
                <span className="font-medium text-brand uppercase">
                  {profile}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border-subtle/40 py-1">
                <span className="text-foreground-subtle">Max Throughput</span>
                <span className="font-bold text-foreground">
                  {peakRate} RPS
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border-subtle/40 py-1">
                <span className="text-foreground-subtle">Virtual Users</span>
                <span className="font-bold text-sand">{maxVUs} VUs</span>
              </div>

              <div className="flex items-center justify-between border-b border-border-subtle/40 py-1">
                <span className="text-foreground-subtle">Duration</span>
                <span className="font-medium text-foreground">
                  {durationSeconds}s
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised/40 px-2 py-1.5">
                <span className="font-semibold text-foreground">
                  Estimated Requests
                </span>
                <span className="text-sm font-bold text-brand">
                  ~{estimatedRequests.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Safety & Launch Card */}
          <Card className="border-brand/40 bg-surface shadow-xl">
            <CardContent className="space-y-4 p-5 font-mono text-xs">
              <div className="flex items-start gap-2.5 text-sand">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-brand" />
                <p className="text-[11px] leading-relaxed">
                  Execution nodes will generate traffic from distributed
                  runners. Automated killswitches halt the test instantly if
                  error rate exceeds 50%.
                </p>
              </div>

              <Button
                onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending || !activeProjectId}
                className="h-11 w-full gap-2 bg-brand font-mono text-xs font-bold text-white shadow-lg hover:bg-brand-hover"
              >
                {launchMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>
                      Launching Test for {activeProject?.name || "Target"}...
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />
                    <span>
                      Launch Load Test for {activeProject?.name || "Target"}
                    </span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function RunnerPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-6 font-mono text-xs text-foreground-muted">
          Loading runner...
        </div>
      }
    >
      <RunnerContent />
    </React.Suspense>
  )
}
