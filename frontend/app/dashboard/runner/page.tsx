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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shell/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { projectApi } from "@/lib/project-api"
import { endpointApi } from "@/lib/endpoint-api"
import { loadtestApi, type LoadTestProfile, type LoadTestModel } from "@/lib/loadtest-api"
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
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return `${pName} • ${prof} • ${timeStr}`
}

function RunnerContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrgId, currentProjectId, setProjectId } = useUIStore()

  const projectParam = searchParams.get("project")
  const activeProjectId = projectParam || currentProjectId || ""

  // State
  const [testScope, setTestScope] = React.useState<"full_server" | "single">("full_server")
  const [safeOnly, setSafeOnly] = React.useState(true)
  const [testName, setTestName] = React.useState("")
  const [isCustomName, setIsCustomName] = React.useState(false)
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
  const activeProject = projectDetailRes?.data || projects.find((p) => p.id === activeProjectId)
  const endpoints = endpointsRes?.data || []
  const isVerified = activeProject?.verification_status === "verified"

  // Automatically update test run name with target project, profile, and timestamp unless user manually typed a custom name
  React.useEffect(() => {
    if (!isCustomName) {
      setTestName(generateDefaultTestName(activeProject?.name, profile))
    }
  }, [activeProject?.name, profile, isCustomName])

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
    if (!isCustomName) {
      setTestName(generateDefaultTestName(activeProject?.name, presetId))
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
      setErrorMessage(err instanceof Error ? err.message : "Failed to launch load test.")
    },
  })

  // Estimated Total Requests
  const estimatedRequests = React.useMemo(() => {
    if (profile === "sustained") {
      return peakRate * durationSeconds
    }
    // Ramp up calculation: average of start and peak during ramp + peak for remainder
    const rampRequests = ((startRate + peakRate) / 2) * Math.min(rampUpSeconds, durationSeconds)
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
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger font-mono">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Target & Verification Context Banner */}
      <Card className="border-border bg-surface relative overflow-hidden">
        <CornerCrosshairs />
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-foreground-subtle uppercase">Target Project:</span>
            <select
              value={activeProjectId}
              onChange={(e) => {
                const newId = e.target.value
                setProjectId(newId)
                router.replace(`/dashboard/runner?project=${newId}`)
              }}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-brand"
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
                  Base URL: <strong className="text-foreground">{activeProject.base_url}</strong>
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
              onClick={() => router.push(`/dashboard/projects/${activeProject.id}`)}
              className="text-xs font-mono text-warning border-warning/40 gap-1.5 shrink-0"
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
        <div className="lg:col-span-2 space-y-6">
          {/* Preset Cards */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold font-heading text-foreground">
              1. Select Workload Profile Preset
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {PRESETS.map((p) => {
                const isSelected = profile === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 space-y-2 ${
                      isSelected
                        ? "border-brand bg-brand/5 shadow-md"
                        : "border-border bg-surface hover:border-border-subtle hover:bg-surface-raised/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-sm text-foreground">
                        {p.title}
                      </span>
                      {isSelected ? (
                        <span className="size-2 rounded-full bg-brand" />
                      ) : (
                        <span className="size-2 rounded-full bg-border-subtle" />
                      )}
                    </div>
                    <span className="inline-block font-mono text-[10px] uppercase text-sand">
                      {p.subtitle}
                    </span>
                    <p className="text-xs text-foreground-muted leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Test Parameters */}
          <Card className="border-border bg-surface">
            <CardHeader className="pb-4 border-b border-border-subtle">
              <CardTitle className="text-sm font-semibold font-heading text-foreground">
                2. Execution & Concurrency Parameters
              </CardTitle>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                Define the rate curve, virtual users limit, and duration bounds.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-5 font-mono text-xs">
              {/* Test Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground-muted text-xs">Test Run Name</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomName(false)
                      setTestName(generateDefaultTestName(activeProject?.name, profile))
                    }}
                    className="text-[11px] text-brand hover:underline font-mono"
                  >
                    Reset with Current Time
                  </button>
                </div>
                <Input
                  value={testName}
                  onChange={(e) => {
                    setIsCustomName(true)
                    setTestName(e.target.value)
                  }}
                  placeholder="e.g. Production API • RAMP • 14:30:00"
                  className="text-xs font-mono bg-surface-raised border-border-subtle"
                />
              </div>

              {/* Peak Rate & Start Rate Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-foreground-muted text-xs">Peak Target (RPS)</Label>
                    <span className="font-bold text-brand">{peakRate} RPS</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={1000}
                    step={10}
                    value={peakRate}
                    onChange={(e) => setPeakRate(Number(e.target.value))}
                    className="w-full accent-brand cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-foreground-muted text-xs">Start Rate (RPS)</Label>
                    <span className="font-bold text-foreground">{startRate} RPS</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={5}
                    value={startRate}
                    onChange={(e) => setStartRate(Number(e.target.value))}
                    className="w-full accent-sand cursor-pointer"
                  />
                </div>
              </div>

              {/* Concurrency & Duration Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-foreground-muted text-xs">Max Virtual Users (VUs)</Label>
                    <span className="font-bold text-sand">{maxVUs} VUs</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={500}
                    step={5}
                    value={maxVUs}
                    onChange={(e) => setMaxVUs(Number(e.target.value))}
                    className="w-full accent-sand cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-foreground-muted text-xs">Total Duration</Label>
                    <span className="font-bold text-foreground">{durationSeconds}s ({Math.round(durationSeconds / 60 * 10) / 10}m)</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={900}
                    step={30}
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    className="w-full accent-foreground cursor-pointer"
                  />
                </div>
              </div>

              {/* Ramp Up Window */}
              {profile === "ramp" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-foreground-muted text-xs">Ramp-Up Window</Label>
                    <span className="font-bold text-sand">{rampUpSeconds}s</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={Math.min(300, durationSeconds)}
                    step={10}
                    value={rampUpSeconds}
                    onChange={(e) => setRampUpSeconds(Number(e.target.value))}
                    className="w-full accent-sand cursor-pointer"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Target HTTP Request Configuration */}
          <Card className="border-border bg-surface">
            <CardHeader className="pb-4 border-b border-border-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold font-heading text-foreground">
                    3. Target Scope & Endpoint Specification
                  </CardTitle>
                  <CardDescription className="text-xs text-foreground-muted font-mono">
                    Benchmark all discovered APIs simultaneously or target a specific route.
                  </CardDescription>
                </div>

                {/* Feature 2: Test Scope Toggle */}
                <div className="inline-flex rounded-lg border border-border-subtle bg-surface-raised p-0.5 font-mono text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setTestScope("full_server")}
                    className={`rounded px-3 py-1.5 transition-colors font-medium flex items-center gap-1.5 ${
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
                    className={`rounded px-3 py-1.5 transition-colors font-medium flex items-center gap-1.5 ${
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

            <CardContent className="pt-6 space-y-4 font-mono text-xs">
              {testScope === "full_server" ? (
                /* Full Server Mode Options */
                <div className="space-y-4">
                  <div className="rounded-xl border border-border-subtle bg-surface-raised/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Globe className="size-4 text-brand" />
                        <span className="font-semibold text-foreground">
                          Distributed Server-Wide Assault
                        </span>
                      </div>
                      <span className="rounded bg-brand/10 border border-brand/20 px-2 py-0.5 text-[11px] text-brand font-bold">
                        {endpoints.length} {endpoints.length === 1 ? "Discovered API" : "Discovered APIs"}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground-muted leading-relaxed">
                      Strim Labs will distribute synthetic traffic across all discovered endpoints for{" "}
                      <strong className="text-foreground">{activeProject?.name || "this project"}</strong>{" "}
                      ({activeProject?.base_url}) to measure aggregate capacity, inflection points, and identify the weakest link.
                    </p>
                  </div>

                  {/* Safe Mode Checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border-subtle bg-surface-raised/60 p-4 hover:border-border transition-colors">
                    <input
                      type="checkbox"
                      checked={safeOnly}
                      onChange={(e) => setSafeOnly(e.target.checked)}
                      className="mt-0.5 size-4 rounded border-border-subtle text-brand focus:ring-brand accent-brand cursor-pointer shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs">
                          Safe Mode: Read-only (GET / HEAD only)
                        </span>
                        <span className="rounded bg-success/15 border border-success/30 px-1.5 py-0.5 text-[10px] text-success font-bold uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground-muted leading-relaxed">
                        Restricts synthetic traffic generation exclusively to read-only idempotent endpoints. Automatically filters out state-mutating requests (POST, PUT, DELETE, PATCH) to safeguard production databases from unintended record modifications.
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
                      <Label className="text-foreground-muted text-xs">Choose Registered Endpoint</Label>
                      <select
                        value={selectedEndpointId}
                        onChange={(e) => handleEndpointSelect(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-brand"
                      >
                        <option value="">-- Custom Target Request --</option>
                        {endpoints.map((ep) => (
                          <option key={ep.id} value={ep.id}>
                            [{ep.method.toUpperCase()}] {ep.path_template} ({ep.service})
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
                      className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xs font-bold text-foreground focus:outline-none focus:border-brand shrink-0"
                    >
                      {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                    <Input
                      placeholder="/orders/checkout"
                      value={targetPath}
                      onChange={(e) => setTargetPath(e.target.value)}
                      className="font-mono text-xs bg-surface-raised border-border-subtle flex-1"
                    />
                  </div>

                  {/* Request Body (for POST/PUT) */}
                  {(targetMethod === "POST" || targetMethod === "PUT" || targetMethod === "PATCH") && (
                    <div className="space-y-1.5">
                      <Label className="text-foreground-muted text-xs">Request JSON Payload (Optional)</Label>
                      <textarea
                        rows={4}
                        placeholder='{"sku": "prod-123", "qty": 1}'
                        value={targetBody}
                        onChange={(e) => setTargetBody(e.target.value)}
                        className="w-full rounded-md border border-border-subtle bg-surface-raised p-2.5 font-mono text-xs text-foreground focus:outline-none focus:border-brand"
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
            <CardHeader className="pb-3 border-b border-border-subtle">
              <CardTitle className="text-sm font-semibold font-heading text-foreground">
                Run Configuration Summary
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-foreground-subtle">Target Project</span>
                <span className="text-foreground font-semibold truncate max-w-[170px]">
                  {activeProject?.name || "None Selected"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-foreground-subtle">Target Host</span>
                <span className="text-foreground font-medium truncate max-w-[150px]">
                  {activeProject?.base_url || "—"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-foreground-subtle">Target Scope</span>
                <span className="text-sand font-medium">
                  {testScope === "full_server"
                    ? `Full Server (${safeOnly ? "Safe Read-Only" : "All Methods"})`
                    : `${targetMethod} ${targetPath}`}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-foreground-subtle">Profile Preset</span>
                <span className="text-brand font-medium uppercase">{profile}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-foreground-subtle">Max Throughput</span>
                <span className="text-foreground font-bold">{peakRate} RPS</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-foreground-subtle">Virtual Users</span>
                <span className="text-sand font-bold">{maxVUs} VUs</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-foreground-subtle">Duration</span>
                <span className="text-foreground font-medium">{durationSeconds}s</span>
              </div>

              <div className="flex justify-between items-center py-1.5 bg-surface-raised/40 px-2 rounded-lg border border-border-subtle">
                <span className="text-foreground font-semibold">Estimated Requests</span>
                <span className="text-brand font-bold text-sm">
                  ~{estimatedRequests.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Safety & Launch Card */}
          <Card className="border-brand/40 bg-surface shadow-xl">
            <CardContent className="p-5 space-y-4 font-mono text-xs">
              <div className="flex items-start gap-2.5 text-sand">
                <ShieldAlert className="size-4 shrink-0 mt-0.5 text-brand" />
                <p className="text-[11px] leading-relaxed">
                  Execution nodes will generate traffic from distributed runners. Automated killswitches halt the test instantly if error rate exceeds 50%.
                </p>
              </div>

              <Button
                onClick={() => launchMutation.mutate()}
                disabled={launchMutation.isPending || !activeProjectId}
                className="w-full h-11 bg-brand text-white hover:bg-brand-hover text-xs font-mono font-bold shadow-lg gap-2"
              >
                {launchMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Launching Test for {activeProject?.name || "Target"}...</span>
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />
                    <span>Launch Load Test for {activeProject?.name || "Target"}</span>
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
    <React.Suspense fallback={<div className="font-mono text-xs p-6 text-foreground-muted">Loading runner...</div>}>
      <RunnerContent />
    </React.Suspense>
  )
}
