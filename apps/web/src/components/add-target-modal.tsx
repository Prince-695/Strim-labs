"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, CheckCircle2, AlertCircle, Loader2, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddTargetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTargetModal({ open, onOpenChange }: AddTargetModalProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [defaultMethod, setDefaultMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">("GET");
  const [bearerToken, setBearerToken] = useState("");
  const [testingReachability, setTestingReachability] = useState(false);
  const [pingResult, setPingResult] = useState<{
    status: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  const createTargetMutation = useMutation({
    mutationFn: async () => {
      if (!session.token || !session.orgId) {
        throw new Error("No active organization session");
      }

      const headers: Record<string, string> = {};
      if (bearerToken.trim()) {
        headers["Authorization"] = bearerToken.startsWith("Bearer ")
          ? bearerToken.trim()
          : `Bearer ${bearerToken.trim()}`;
      }

      return api<{ project: { id: string; name: string; targetUrl: string; defaultMethod: string } }>(
        "/v1/projects",
        {
          method: "POST",
          token: session.token,
          orgId: session.orgId,
          body: JSON.stringify({
            name: name.trim(),
            targetUrl: targetUrl.trim(),
            defaultMethod,
            defaultHeaders: Object.keys(headers).length > 0 ? headers : undefined,
          }),
        }
      );
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["projects", session.orgId] });
      session.setProjectId(res.project.id);
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setName("");
    setTargetUrl("");
    setDefaultMethod("GET");
    setBearerToken("");
    setPingResult(null);
  };

  const handleTestReachability = async () => {
    if (!targetUrl.trim()) return;
    setTestingReachability(true);
    setPingResult(null);

    const startTime = performance.now();
    try {
      // Direct client check (or CORS fallback)
      const res = await fetch(targetUrl.trim(), {
        method: defaultMethod === "GET" ? "HEAD" : defaultMethod,
        mode: "no-cors",
        signal: AbortSignal.timeout(5000),
      });
      const durationMs = Math.round(performance.now() - startTime);
      setPingResult({
        status: "success",
        message: `Host reached in ${durationMs}ms (opaque/reachable)`,
      });
    } catch (err: any) {
      setPingResult({
        status: "warning",
        message: `Direct ping timed out or blocked by CORS (${err?.message || "Verify target URL is online"}). The backend load engine will test directly.`,
      });
    } finally {
      setTestingReachability(false);
    }
  };

  const fillLocalDemoTarget = () => {
    setName("Local Strim Health API");
    setTargetUrl("http://localhost:3001/health");
    setDefaultMethod("GET");
    setBearerToken("");
    setPingResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                <Target className="size-4" />
              </div>
              <DialogTitle className="text-base font-semibold">Register Target API</DialogTitle>
            </div>
            <button
              type="button"
              onClick={fillLocalDemoTarget}
              className="text-[11px] font-medium text-brand hover:underline flex items-center gap-1"
            >
              <Globe className="size-3" />
              Use Local Demo API
            </button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Specify an HTTP API endpoint to benchmark, monitor breaking points, and gate in CI/CD.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTargetMutation.mutate();
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="target-name" className="text-xs font-medium">
              Target Name
            </Label>
            <Input
              id="target-name"
              placeholder="e.g. Checkout Service, Search API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="target-url" className="text-xs font-medium">
                Endpoint URL
              </Label>
              <button
                type="button"
                onClick={handleTestReachability}
                disabled={!targetUrl.trim() || testingReachability}
                className="text-[11px] font-medium text-brand hover:text-brand-strong disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {testingReachability && <Loader2 className="size-3 animate-spin" />}
                Test Reachability
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={defaultMethod}
                onValueChange={(v) => {
                  if (v) setDefaultMethod(v as "GET" | "POST" | "PUT" | "DELETE");
                }}
              >
                <SelectTrigger className="w-24 h-9 text-xs font-mono font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET" className="text-xs font-mono">GET</SelectItem>
                  <SelectItem value="POST" className="text-xs font-mono">POST</SelectItem>
                  <SelectItem value="PUT" className="text-xs font-mono">PUT</SelectItem>
                  <SelectItem value="DELETE" className="text-xs font-mono">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="target-url"
                type="url"
                placeholder="https://api.example.com/health"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                required
                className="h-9 text-xs font-mono flex-1"
              />
            </div>
            {pingResult && (
              <div
                className={`text-[11px] p-2 rounded-md flex items-start gap-1.5 mt-1.5 ${
                  pingResult.status === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                {pingResult.status === "success" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                )}
                <span>{pingResult.message}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bearer-token" className="text-xs font-medium text-muted-foreground">
              Bearer Token / Auth Header (Optional)
            </Label>
            <Input
              id="bearer-token"
              type="password"
              placeholder="e.g. sk_live_... or token string"
              value={bearerToken}
              onChange={(e) => setBearerToken(e.target.value)}
              className="h-9 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Encrypted at rest with AES-256-GCM. Injected automatically during load generation.
            </p>
          </div>

          {createTargetMutation.isError && (
            <div className="text-[11px] p-2.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                {createTargetMutation.error instanceof Error
                  ? createTargetMutation.error.message
                  : "Failed to create target"}
              </span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createTargetMutation.isPending || !name.trim() || !targetUrl.trim()}
              className="text-xs h-8 bg-brand hover:bg-brand-strong text-white"
            >
              {createTargetMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Saving…
                </>
              ) : (
                <>
                  <Plus className="size-3.5 mr-1" />
                  Create Target
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
