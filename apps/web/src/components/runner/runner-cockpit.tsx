"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Compass, Crosshair, FlaskConical, Play, ShieldAlert, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { LiveCockpit } from "@/components/runner/live-cockpit";
import { PresetCard } from "@/components/runner/preset-card";
import { AddTargetModal } from "@/components/add-target-modal";
import { Alert } from "@/components/ui/alert";
import { AccordionItem } from "@/components/ui/accordion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { hostOf, isAbortedStatus, isTerminalStatus } from "@/lib/format";
import { setLiveRun } from "@/lib/live-run";
import { DEMO_TARGET, PRESETS, type Preset } from "@/lib/presets";
import { useCreateProject, useRuns } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { openRunStream } from "@/lib/sse";
import type { StreamState, TestProfile, TestRun, TestSample } from "@/lib/types";
import { cn } from "@/lib/utils";

type ActiveRun = { id: string; name: string; durationSec: number; concurrency: number; startedAtMs: number };

function parseHeaders(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k) out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function RunnerCockpitContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { project, projectId, projects, setProjectId, projectsLoading, call, orgId, token } = useSession();
  const createProject = useCreateProject();
  const runsQuery = useRuns(projectId);

  // Configuration
  const [presetId, setPresetId] = useState<Preset["id"] | "custom">("ramp");
  const [concurrency, setConcurrency] = useState(50);
  const [durationSec, setDurationSec] = useState(30);
  const [profile, setProfile] = useState<TestProfile>("RAMP_UP");
  const [headersText, setHeadersText] = useState("");
  const [payload, setPayload] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live run
  const [active, setActive] = useState<ActiveRun | null>(null);
  const [samples, setSamples] = useState<TestSample[]>([]);
  const [stream, setStream] = useState<StreamState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [abortedRunId, setAbortedRunId] = useState<string | null>(null);
  const disposeRef = useRef<(() => void) | null>(null);
  const resumedRef = useRef(false);

  const applyPreset = useCallback((p: Preset) => {
    setPresetId(p.id);
    setConcurrency(p.concurrency);
    setDurationSec(p.durationSec);
    setProfile(p.profile);
  }, []);

  const finish = useCallback(
    (id: string, aborted: boolean) => {
      disposeRef.current?.();
      disposeRef.current = null;
      setLiveRun(null);
      void qc.invalidateQueries({ queryKey: ["runs"] });
      void qc.invalidateQueries({ queryKey: ["run"] });
      if (aborted) {
        setCancelling(false);
        setActive(null);
        setAbortedRunId(id);
        toast.success("Test aborted. Workers have stopped.");
      } else {
        toast.success("Test complete. Opening results…");
        router.push(`/tests/${id}`);
      }
    },
    [qc, router],
  );

  const attach = useCallback(
    (run: ActiveRun, token: string, org: string) => {
      disposeRef.current?.();
      setActive(run);
      setSamples([]);
      setElapsed(Math.max(0, (Date.now() - run.startedAtMs) / 1000));
      setStream("connecting");
      setLiveRun(run.id);
      disposeRef.current = openRunStream({
        runId: run.id,
        token,
        orgId: org,
        onSample: (s) => {
          setSamples((prev) => (prev.length > 1200 ? [...prev.slice(-1000), s] : [...prev, s]));
          setLastUpdate(Date.now());
        },
        onState: setStream,
        onDone: () => finish(run.id, false),
        onAbort: () => finish(run.id, true),
      });
    },
    [finish],
  );

  // Resume a run that is already executing
  useEffect(() => {
    if (resumedRef.current || !runsQuery.data || !token || !orgId || active) return;
    const running = runsQuery.data.find((r) => r.status === "RUNNING" || r.status === "QUEUED");
    if (!running) return;
    resumedRef.current = true;
    attach(
      {
        id: running.id,
        name: running.name,
        durationSec: running.durationSec,
        concurrency: running.concurrency,
        startedAtMs: new Date(running.startedAt || running.createdAt).getTime(),
      },
      token,
      orgId,
    );
  }, [runsQuery.data, token, orgId, active, attach]);

  // Elapsed clock
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setElapsed(Math.min(active.durationSec, (Date.now() - active.startedAtMs) / 1000)), 250);
    return () => clearInterval(id);
  }, [active]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      disposeRef.current?.();
      setLiveRun(null);
    },
    [],
  );

  // Warn before closing the tab mid-test
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  async function launch() {
    if (!project || !token || !orgId) return;
    setFormError(null);
    if (!authorized) {
      setFormError("Confirm you're authorised to send this load before launching.");
      return;
    }
    if (!Number.isFinite(concurrency) || concurrency < 1 || !Number.isFinite(durationSec) || durationSec < 1) {
      setFormError("Virtual users and duration must be at least 1.");
      return;
    }
    setStarting(true);
    setAbortedRunId(null);
    try {
      const preset = PRESETS.find((p) => p.id === presetId);
      const { run } = await call<{ run: TestRun }>("/v1/load-tests", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          name: `${preset?.name ?? "Custom run"} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          profile,
          concurrency,
          durationSec,
          headers: parseHeaders(headersText),
          payload: payload.trim() || undefined,
        }),
      });
      attach(
        { id: run.id, name: run.name, durationSec: run.durationSec ?? durationSec, concurrency: run.concurrency ?? concurrency, startedAtMs: Date.now() },
        token,
        orgId,
      );
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Couldn't start the test. Try again.");
    } finally {
      setStarting(false);
    }
  }

  async function abort() {
    if (!active || cancelling) return;
    setCancelling(true);
    try {
      await call(`/v1/load-tests/${active.id}/abort`, { method: "POST" });
      const id = active.id;
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 800));
        if (!disposeRef.current) return;
        const { run } = await call<{ run: TestRun }>(`/v1/load-tests/${id}`);
        if (isTerminalStatus(run.status)) {
          finish(id, isAbortedStatus(run.status));
          return;
        }
      }
      toast.warning("The server hasn't confirmed cancellation yet. Check the run status.");
    } catch (e) {
      setCancelling(false);
      toast.error(e instanceof ApiError ? e.message : "Couldn't abort the test.");
    }
  }

  async function useDemoTarget() {
    try {
      await createProject.mutateAsync({ name: DEMO_TARGET.name, targetUrl: DEMO_TARGET.targetUrl, defaultMethod: DEMO_TARGET.defaultMethod });
      toast.success("Local demo target added");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't add the demo target.");
    }
  }

  if (projectsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PRESETS.map((p) => (
            <Skeleton key={p.id} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <>
        <PageHeader title="Breakpoint Runner" description="Launch a benchmark and watch live telemetry unfold." />
        <Card>
          <EmptyState
            icon={Crosshair}
            title="Add a target to start testing"
            description="A target is the API endpoint you want to load. Add your own, or use the bundled demo server to see the full flow with zero setup."
            action={
              <>
                <Button onClick={() => setAddOpen(true)}>Add target</Button>
                <Button variant="outline" onClick={useDemoTarget} loading={createProject.isPending}>
                  <FlaskConical /> Use local demo API
                </Button>
              </>
            }
          />
        </Card>
        <AddTargetModal open={addOpen} onOpenChange={setAddOpen} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait" initial={false}>
        {active ? (
          <motion.div key="live" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <LiveCockpit
              name={active.name}
              samples={samples}
              durationSec={active.durationSec}
              targetConcurrency={active.concurrency}
              elapsedSec={elapsed}
              stream={stream}
              cancelling={cancelling}
              lastUpdate={lastUpdate}
              onAbort={abort}
            />
          </motion.div>
        ) : (
          <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="space-y-6">
            {abortedRunId && (
              <Alert
                tone="success"
                title="Test aborted"
                action={
                  <Link href={`/tests/${abortedRunId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    View partial results
                  </Link>
                }
              >
                The server confirmed cancellation. Whatever was measured before the abort is saved.
              </Alert>
            )}

            {/* Target Endpoint Info */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Endpoint</span>
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-foreground">
                    {project.defaultMethod}
                  </span>
                </div>
                <p className="truncate font-mono text-xs font-semibold text-foreground">{project.targetUrl}</p>
              </div>

              <div className="flex items-center gap-2 pt-1 sm:pt-0 shrink-0">
                <Link
                  href={`/projects/${project.id}/explorer`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Compass className="size-3.5 mr-1.5 text-brand" /> API Explorer
                </Link>
              </div>
            </div>

            <section aria-label="Load presets">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {PRESETS.map((p) => (
                  <PresetCard key={p.id} preset={p} selected={presetId === p.id} onSelect={() => applyPreset(p)} />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Presets are calibrated starting points. The server enforces its own concurrency and duration limits.</p>
            </section>

            <Card>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="vus" label="Virtual users">
                    <Input
                      id="vus"
                      type="number"
                      min={1}
                      max={1000}
                      value={concurrency}
                      onChange={(e) => {
                        setConcurrency(Number(e.target.value));
                        setPresetId("custom");
                      }}
                      className="font-mono"
                    />
                  </Field>
                  <Field id="duration" label="Duration (seconds)">
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      max={600}
                      value={durationSec}
                      onChange={(e) => {
                        setDurationSec(Number(e.target.value));
                        setPresetId("custom");
                      }}
                      className="font-mono"
                    />
                  </Field>
                  <Field id="profile" label="Load curve">
                    <Select
                      id="profile"
                      value={profile}
                      onChange={(e) => {
                        setProfile(e.target.value as TestProfile);
                        setPresetId("custom");
                      }}
                    >
                      <option value="SUSTAINED">Sustained</option>
                      <option value="RAMP_UP">Ramp-up</option>
                      <option value="SPIKE">Spike</option>
                    </Select>
                  </Field>
                </div>

                <div className="rounded-xl border border-border">
                  <div className="px-4">
                    <AccordionItem
                      icon={<SlidersHorizontal className="size-4 text-muted-foreground" />}
                      title="Advanced: request headers and body"
                      meta={<span className="text-xs font-normal text-muted-foreground">Optional</span>}
                    >
                      <div className="space-y-4 pt-1">
                        <Field id="headers" label="Custom headers" hint="One per line, as Name: value. For example Authorization: Bearer …">
                          <Textarea id="headers" value={headersText} onChange={(e) => setHeadersText(e.target.value)} placeholder={"x-api-key: …\nAuthorization: Bearer …"} spellCheck={false} />
                        </Field>
                        <Field id="payload" label="Request body" hint="Sent with every request. Use JSON or plain text.">
                          <Textarea id="payload" value={payload} onChange={(e) => setPayload(e.target.value)} placeholder='{"example": true}' spellCheck={false} />
                        </Field>
                        <p className="flex items-start gap-2 text-xs text-warning-text">
                          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          Headers and bodies are encrypted at rest, but avoid putting production secrets in test traffic when you can.
                        </p>
                      </div>
                    </AccordionItem>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-muted/50 p-4">
                  <h3 className="text-sm font-semibold">Safety summary</h3>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                    <Row k="Target" v={`${project.defaultMethod} ${hostOf(project.targetUrl)}`} />
                    <Row k="Load" v={`${concurrency} virtual users`} />
                    <Row k="Duration" v={`${durationSec} seconds`} />
                    <Row k="Curve" v={profile === "RAMP_UP" ? "Ramp-up" : profile === "SPIKE" ? "Spike" : "Sustained"} />
                  </dl>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed">
                    <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
                    <span>I own this endpoint or have permission to test it, and I understand this sends real traffic to it.</span>
                  </label>
                </div>

                {formError && (
                  <Alert tone="danger" title="Can't launch yet">
                    {formError}
                  </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">You can abort at any time. Cancellation stops all workers in under 200 ms.</p>
                  <Button size="lg" onClick={launch} loading={starting} disabled={!authorized} className={cn(authorized && "shadow-[0_10px_30px_-10px_var(--brand)]")}>
                    <Play /> Launch test run <ArrowRight />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <AddTargetModal open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate font-mono font-medium">{v}</dd>
    </div>
  );
}

export function RunnerCockpit() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <RunnerCockpitContent />
    </Suspense>
  );
}
