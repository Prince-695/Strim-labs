"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Key,
  Layers,
  Radio,
  Server,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useCreateProject } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { normalizeUrl, validateRequired, validateTargetUrl, type FieldErrors } from "@/lib/validation";
import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";
import { Field } from "./ui/label";

type Framework = "hono" | "express" | "nextjs" | "fastify";

export function AddTargetModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const create = useCreateProject();
  const { projects, call } = useSession();

  // Wizard steps: 1 = Form, 2 = SDK Onboarding & Live Listener
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"name" | "baseUrl">>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Step 2 State
  const [createdProject, setCreatedProject] = useState<{ id: string; name: string } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Framework>("hono");
  const [connected, setConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);

  function reset() {
    setStep(1);
    setName("");
    setBaseUrl("");
    setErrors({});
    setServerError(null);
    setCreatedProject(null);
    setApiKey("");
    setConnected(false);
    setSimulating(false);
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) setTimeout(reset, 250);
  }

  // Poll project status in Step 2 until status is ACTIVE
  useEffect(() => {
    if (step !== 2 || !createdProject || connected) return;

    const interval = setInterval(async () => {
      try {
        const res = await call<{ project: { id: string; status: string } }>(
          `/v1/projects/${createdProject.id}`
        );
        if (res.project.status === "ACTIVE") {
          setConnected(true);
          toast.success("Telemetry received! Production observability active.");
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [step, createdProject, connected, call]);

  async function handleCreateProject() {
    const next: FieldErrors<"name" | "baseUrl"> = {
      name: validateRequired(name, "a name for this project"),
      baseUrl: validateTargetUrl(baseUrl || "http://localhost:3000"),
    };

    setErrors(next);
    if (next.name || next.baseUrl) return;
    setServerError(null);

    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        baseUrl: normalizeUrl(baseUrl || "http://localhost:3000"),
        targetUrl: normalizeUrl(baseUrl || "http://localhost:3000"),
      });

      setCreatedProject({ id: res.project.id, name: res.project.name });
      setApiKey(res.apiKey);
      setStep(2);
      toast.success(`Project "${res.project.name}" registered!`);
    } catch (e) {
      setServerError(
        e instanceof ApiError
          ? e.message
          : "Couldn't create the project. You may have hit the 5-project limit."
      );
    }
  }

  async function handleSimulatePing() {
    if (!apiKey || !createdProject) return;
    setSimulating(true);
    try {
      await fetch("http://localhost:8080/v1/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-strim-key": apiKey,
        },
        body: JSON.stringify({
          events: [
            {
              method: "GET",
              path: "/api/health",
              statusCode: 200,
              durationMs: 38,
            },
            {
              method: "POST",
              path: "/api/checkout",
              statusCode: 200,
              durationMs: 142,
            },
          ],
        }),
      });

      setConnected(true);
      toast.success("Test telemetry event sent & verified!");
    } catch {
      toast.error("Failed to reach STRIM Ingestion service.");
    } finally {
      setSimulating(false);
    }
  }

  function copyApiKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopiedKey(false), 2000);
  }

  const getSnippet = () => {
    switch (activeTab) {
      case "hono":
        return `// 1. Install package\nbun add @strim/sdk\n\n// 2. Attach middleware in your server\nimport { Hono } from "hono";\nimport { strimHono } from "@strim/sdk";\n\nconst app = new Hono();\napp.use("*", strimHono({ apiKey: "${apiKey}" }));\n\nexport default app;`;
      case "express":
        return `// 1. Install package\nnpm install @strim/sdk\n\n// 2. Attach middleware in server.js\nimport express from "express";\nimport { strimExpress } from "@strim/sdk";\n\nconst app = express();\napp.use(strimExpress({ apiKey: "${apiKey}" }));\n\napp.listen(3000);`;
      case "nextjs":
        return `// 1. Install package\nnpm install @strim/sdk\n\n// 2. Wrap your route handler in app/api/.../route.ts\nimport { strimNext } from "@strim/sdk";\n\nexport const GET = strimNext(async (req) => {\n  return Response.json({ ok: true });\n}, { apiKey: "${apiKey}" });`;
      case "fastify":
        return `// 1. Install package\nnpm install @strim/sdk\n\n// 2. Register hook in fastify\nimport Fastify from "fastify";\nimport { strimFastify } from "@strim/sdk";\n\nconst fastify = Fastify();\nfastify.addHook("onResponse", strimFastify({ apiKey: "${apiKey}" }));\n\nfastify.listen({ port: 3000 });`;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={step === 1 ? "Add New Project or Server" : `Connect ${createdProject?.name || "Project"}`}
      description={
        step === 1
          ? "Connect a service for continuous production observability, 7-day breakpoint diagnosis, and auto route discovery."
          : "Add the @strim/sdk middleware to your server. We'll automatically capture routes and diagnose breakpoints."
      }
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} loading={create.isPending}>
              Generate API Key & Continue <ArrowRight className="size-4" />
            </Button>
          </>
        ) : (
          <div className="flex w-full items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulatePing}
              loading={simulating}
              className="text-xs"
            >
              <Zap className="size-3.5 text-warning" /> Simulate Connection Ping
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                Done
              </Button>
              <Button
                onClick={() => {
                  close(false);
                  if (createdProject) {
                    router.push(`/projects/${createdProject.id}`);
                  }
                }}
              >
                Go to Project Console <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )
      }
    >
      {step === 1 ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreateProject();
          }}
          noValidate
        >
          {/* Organization project limits pill */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/60 px-4 py-2.5 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Layers className="size-3.5 text-brand" /> Active Projects
            </span>
            <span className="font-mono text-muted-foreground">
              {projects.length} / 5 limit
            </span>
          </div>

          <Field id="project-name" label="Project Name" error={errors.name}>
            <Input
              id="project-name"
              data-autofocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Checkout Gateway, Auth API, Microservice A"
              aria-invalid={Boolean(errors.name)}
            />
          </Field>

          <Field
            id="project-base-url"
            label="Base URL / Target"
            error={errors.baseUrl}
            hint="The public or staging URL where your server is hosted."
          >
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="project-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.mycorp.com or http://localhost:3000"
                className="pl-9 font-mono text-[13px]"
                aria-invalid={Boolean(errors.baseUrl)}
              />
            </div>
          </Field>

          {serverError && (
            <Alert tone="danger" title="Unable to create project">
              {serverError}
            </Alert>
          )}
        </form>
      ) : (
        <div className="space-y-5">
          {/* API Key Box */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Key className="size-3.5 text-brand" /> Project API Key
              </span>
              <span className="rounded bg-brand-subtle px-2 py-0.5 text-[10px] font-semibold text-brand-strong">
                Production Token
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2">
              <code className="flex-1 font-mono text-xs">
                {showKey ? apiKey : `${apiKey.slice(0, 15)}••••••••••••••••••••••••••••`}
              </code>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <button
                type="button"
                onClick={copyApiKey}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-strong"
              >
                {copiedKey ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Add this to your server environment as <code className="font-mono">STRIM_API_KEY</code>.
            </p>
          </div>

          {/* Connection Listener Banner */}
          <div
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-colors ${
              connected
                ? "border-success/40 bg-success/10 text-success-text"
                : "border-border bg-surface-muted/50"
            }`}
          >
            <div className="flex items-center gap-3">
              {connected ? (
                <div className="grid size-8 place-items-center rounded-full bg-success/20 text-success">
                  <CheckCircle2 className="size-5" />
                </div>
              ) : (
                <div className="relative grid size-8 place-items-center rounded-full bg-brand/10">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand/30" />
                  <Radio className="size-4 text-brand" />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold">
                  {connected ? "Server Connected!" : "Listening for first request..."}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {connected
                    ? "Initial API routes successfully ingested and registered."
                    : "Install the SDK and make any HTTP request to your server."}
                </p>
              </div>
            </div>
            {connected && <Badge tone="success">Active</Badge>}
          </div>

          {/* Code Snippets */}
          <div>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-medium text-muted-foreground">Select framework</span>
              <div className="flex gap-1">
                {(["hono", "express", "nextjs", "fastify"] as Framework[]).map((fw) => (
                  <button
                    key={fw}
                    type="button"
                    onClick={() => setActiveTab(fw)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors ${
                      activeTab === fw
                        ? "bg-brand text-white"
                        : "text-muted-foreground hover:bg-surface-muted"
                    }`}
                  >
                    {fw}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 relative">
              <pre className="max-h-56 overflow-x-auto rounded-xl border border-border bg-neutral-950 p-3.5 font-mono text-[12px] leading-relaxed text-neutral-200">
                {getSnippet()}
              </pre>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
