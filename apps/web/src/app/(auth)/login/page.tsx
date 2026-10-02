"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, API_URL } from "@/lib/api";
import { useSession, type Org } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setSession, token, loading } = useSession();
  const [email, setEmail] = useState("priya@acme.test");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && token) router.replace("/runtime");
  }, [loading, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await api<{ token: string; organizations: Org[] }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(res.token, res.organizations);
      router.push("/runtime");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      const res = await api<{ url?: string }>("/v1/auth/google/url");
      if (res.url) {
        window.location.href = res.url;
      } else {
        setError("Google OAuth is not configured in this environment.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate Google login");
    }
  }

  function setDemoPersona(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  }

  return (
    <Card className="border border-border/80 shadow-md rounded-2xl bg-card">
      <CardHeader className="space-y-1.5 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold tracking-tight">Sign in to Strim</CardTitle>
          <span className="text-xs text-muted-foreground">Production</span>
        </div>
        <CardDescription className="text-xs">
          Enter your credentials to access your organization's runtime model.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Demo Switcher */}
        <div className="p-3 rounded-xl bg-secondary/50 border border-border/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-brand-pink" />
            <span>Quick-Fill Seeded Demo Personas:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDemoPersona("priya@acme.test", "password123")}
              className="text-xs px-2.5 py-1 rounded-full bg-card hover:bg-card/80 border border-border/70 text-foreground transition-colors font-medium shadow-2xs"
            >
              Priya (Acme Corp Owner)
            </button>
            <button
              type="button"
              onClick={() => setDemoPersona("marcus@globex.test", "password123")}
              className="text-xs px-2.5 py-1 rounded-full bg-card hover:bg-card/80 border border-border/70 text-foreground transition-colors font-medium shadow-2xs"
            >
              Marcus (Globex Admin)
            </button>
          </div>
        </div>

        {/* Google OAuth Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full h-10 rounded-full font-semibold border-border hover:bg-secondary/70 flex items-center justify-center gap-2 text-xs"
        >
          <svg className="size-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-border w-full" />
          <span className="bg-card px-3 text-[11px] uppercase tracking-wider text-muted-foreground absolute">
            or with email
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold">
              Work Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoComplete="email"
              className="h-10 rounded-full px-4 text-xs bg-secondary/40 border-border/80 focus:bg-card"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-10 rounded-full px-4 text-xs bg-secondary/40 border-border/80 focus:bg-card"
            />
          </div>

          {error && (
            <Alert variant="destructive" className="py-2 px-3 rounded-xl text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={pending}
            className="w-full h-10 rounded-full font-bold bg-[#0D0C22] text-white hover:opacity-90 dark:bg-white dark:text-[#0D0C22] text-xs shadow-xs"
          >
            {pending ? "Signing in…" : "Sign In to Platform"}
            <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-brand-pink font-semibold hover:underline">
              Create one now
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
