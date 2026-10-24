"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSession, type Org } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Sparkles, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setSession, token, loading } = useSession();
  const [email, setEmail] = useState("priya@acme.test");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && token) router.replace("/");
  }, [loading, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await api<{ token: string; orgs: Org[] }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(res.token, res.orgs);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setPending(false);
    }
  }

  function setDemoPersona(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  }

  return (
    <div>
      <Card className="border border-border/60 shadow-md rounded-xl bg-card">
        <CardHeader className="space-y-1.5 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-heading font-bold tracking-tight">
              Sign In to STRIM
            </CardTitle>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground uppercase font-semibold">
              Console
            </span>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Access your API benchmarks, capacity telemetry, and CI/CD gates.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Demo Switcher */}
          <div className="p-3 rounded-lg bg-secondary/50 border border-border/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3 text-brand" />
              <span>Quick Demo Account:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDemoPersona("priya@acme.test", "password123")}
                className="text-xs px-2.5 py-1 rounded-md bg-card hover:bg-card/80 border border-border/70 text-foreground transition-colors font-medium shadow-xs cursor-pointer"
              >
                Priya (Acme Corp Owner)
              </button>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Email address</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-9 text-xs rounded-lg bg-secondary/40 border-border/80"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Password</Label>
              </div>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 text-xs rounded-lg bg-secondary/40 border-border/80"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="py-2 px-3 rounded-lg text-xs">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-brand hover:bg-brand-strong text-white font-medium text-xs h-9 shadow-sm"
            >
              {pending ? "Signing in…" : "Sign In to STRIM"}
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground pt-1">
            Don't have an account?{" "}
            <Link href="/signup" className="text-brand font-semibold hover:underline">
              Create workspace
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
