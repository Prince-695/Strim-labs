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
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const { setSession, token, loading } = useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && token) router.replace("/");
  }, [loading, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setPending(true);
    try {
      const res = await api<{
        token: string;
        user: { id: string; email: string; name: string };
        orgs: Org[];
      }>("/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          organizationName,
        }),
      });

      setSession(res.token, res.orgs);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Card className="border border-border/60 shadow-md rounded-xl bg-card">
        <CardHeader className="space-y-1.5 pb-4">
          <CardTitle className="text-xl font-heading font-bold tracking-tight">
            Create STRIM Workspace
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Start stress testing your APIs with real-time breaking point detection.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Your full name</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Sharma"
                className="h-9 text-xs rounded-lg bg-secondary/40 border-border/80"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Work email address</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-9 text-xs rounded-lg bg-secondary/40 border-border/80"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Organization / Team name</Label>
              <Input
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="Acme Platform Team"
                className="h-9 text-xs rounded-lg bg-secondary/40 border-border/80"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Create password (min. 8 characters)</Label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
              className="w-full rounded-lg bg-brand hover:bg-brand-strong text-white font-medium text-xs h-9 shadow-sm mt-1"
            >
              {pending ? "Creating account…" : "Create Workspace"}
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground pt-1">
            Already have an account?{" "}
            <Link href="/login" className="text-brand font-semibold hover:underline">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
