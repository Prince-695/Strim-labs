"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, AppWindow, Copy, Check, Server, Terminal, Shield } from "lucide-react";

type Application = {
  id: string;
  name: string;
  language?: string;
  framework?: string;
  region?: string;
  ownerTeam?: { id: string; name: string };
  oncallTeam?: { id: string; name: string };
  environments: { id: string; name: string; type: string }[];
};

export default function ApplicationsPage() {
  const { token, orgId, projectId, workspaces } = useSession();
  const qc = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [createdSnippet, setCreatedSnippet] = useState<{ appName: string; apiKey?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [framework, setFramework] = useState("hono");
  const [region, setRegion] = useState("us-east-1");

  const q = useQuery({
    queryKey: ["applications", orgId],
    enabled: Boolean(token && orgId),
    queryFn: () => api<{ applications: Application[] }>("/v1/org/applications", { token, orgId }),
  });

  const createApp = useMutation({
    mutationFn: async () => {
      const activeProject = projectId ?? workspaces[0]?.projects[0]?.id;
      if (!activeProject) throw new Error("No active project selected");

      // 1. Create application
      const app = await api<Application>("/v1/org/applications", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({
          projectId: activeProject,
          name,
          language,
          framework,
          region,
        }),
      });

      // 2. Create environments (development, staging, production)
      await Promise.all([
        api("/v1/org/environments", {
          method: "POST",
          token,
          orgId,
          body: JSON.stringify({ applicationId: app.id, name: "production", type: "PRODUCTION" }),
        }),
        api("/v1/org/environments", {
          method: "POST",
          token,
          orgId,
          body: JSON.stringify({ applicationId: app.id, name: "staging", type: "STAGING" }),
        }),
      ]);

      // 3. Create initial API key
      const keyRes = await api<{ rawKey: string }>("/v1/api-keys", {
        method: "POST",
        token,
        orgId,
        body: JSON.stringify({ name: `${name}-sdk-key`, role: "ingest" }),
      }).catch(() => null);

      return { app, rawKey: keyRes?.rawKey ?? "strim_live_sample_key" };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["org-context"] });
      setCreatedSnippet({ appName: data.app.name, apiKey: data.rawKey });
    },
  });

  const rows = q.data?.applications ?? [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeSnippet = createdSnippet
    ? `import { strim } from "@strim/sdk";

// Initialize Strim SDK inside your service
strim.init({
  projectId: "${createdSnippet.appName}",
  environment: process.env.NODE_ENV === "production" ? "production" : "staging",
  apiKey: "${createdSnippet.apiKey}",
});

// Attach Hono / Express middleware
app.use("*", strim.middleware());`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Applications & Services</h1>
          <p className="text-sm text-muted-foreground">
            Microservices, API gateways, serverless workers, and distributed topologies.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="cursor-pointer gap-2">
          <Plus className="size-4" />
          Onboard Application
        </Button>
      </div>

      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle>Connected Systems Directory</CardTitle>
          <CardDescription>
            Registered services reporting runtime telemetry and configuration states.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Stack</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead>Environments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Server className="size-4" />
                      </div>
                      <div className="font-medium text-foreground">{a.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {a.language ?? "typescript"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {a.framework ?? "hono"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.region ?? "us-east-1"}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div>Owner: {a.ownerTeam?.name ?? "Engineering"}</div>
                      <div className="text-muted-foreground">On-call: {a.oncallTeam?.name ?? "Primary"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {a.environments.map((e) => (
                        <Badge
                          key={e.id}
                          variant={e.type === "PRODUCTION" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {e.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No applications registered yet. Click &quot;Onboard Application&quot; to register a service.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Onboarding Wizard Dialog */}
      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) {
            setCreatedSnippet(null);
            setName("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          {!createdSnippet ? (
            <>
              <DialogHeader>
                <DialogTitle>Onboard New Service</DialogTitle>
                <DialogDescription>
                  Register a microservice or backend application to receive runtime intelligence.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="appName">Service Name (slug)</Label>
                  <Input
                    id="appName"
                    placeholder="e.g. checkout-service"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lang">Runtime Language</Label>
                    <select
                      id="lang"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="typescript">TypeScript / Node.js</option>
                      <option value="python">Python</option>
                      <option value="golang">Go</option>
                      <option value="rust">Rust</option>
                      <option value="java">Java / Kotlin</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="framework">Framework</Label>
                    <select
                      id="framework"
                      value={framework}
                      onChange={(e) => setFramework(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="hono">Hono</option>
                      <option value="express">Express</option>
                      <option value="nextjs">Next.js</option>
                      <option value="fastapi">FastAPI</option>
                      <option value="gin">Gin</option>
                      <option value="actix">Actix</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="region">Cloud Region</Label>
                  <Input
                    id="region"
                    placeholder="us-east-1"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setWizardOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button
                  onClick={() => createApp.mutate()}
                  disabled={!name.trim() || createApp.isPending}
                  className="cursor-pointer"
                >
                  {createApp.isPending ? "Provisioning..." : "Provision & Generate SDK"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-emerald-500">
                  <Check className="size-5" />
                  <DialogTitle>Application Ready!</DialogTitle>
                </div>
                <DialogDescription>
                  Your application and default environments (staging, production) have been provisioned.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Terminal className="size-3.5" /> 1. Install SDK
                  </Label>
                  <div className="rounded-md bg-muted p-2.5 font-mono text-xs text-foreground flex items-center justify-between">
                    <span>npm install @strim/sdk</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0 cursor-pointer"
                      onClick={() => copyToClipboard("npm install @strim/sdk")}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Server className="size-3.5" /> 2. Initialize in your Application
                  </Label>
                  <div className="relative rounded-md bg-muted p-3 font-mono text-xs text-foreground overflow-x-auto">
                    <pre>{codeSnippet}</pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2 size-7 p-0 cursor-pointer"
                      onClick={() => copyToClipboard(codeSnippet)}
                    >
                      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button onClick={() => setWizardOpen(false)} className="cursor-pointer">
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
