"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);

    try {
      await api("/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process request");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Card className="border border-border/60 shadow-md rounded-xl bg-card">
        <CardHeader className="space-y-1.5 pb-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="size-3" /> Back to sign in
          </Link>
          <CardTitle className="text-xl font-heading font-bold tracking-tight">
            Reset Password
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Enter your email and we'll send you instructions to reset your password.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {sent ? (
            <div className="space-y-4 text-center py-4">
              <div className="size-12 rounded-xl bg-brand/15 text-brand flex items-center justify-center mx-auto">
                <CheckCircle className="size-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Check your inbox</h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  If an account exists for <span className="font-semibold text-foreground">{email}</span>, a password reset link was sent.
                </p>
              </div>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-9 rounded-lg w-full text-xs font-medium inline-flex items-center justify-center cursor-pointer",
                )}
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Account Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    autoComplete="email"
                    className="h-9 rounded-lg pl-9 pr-3 text-xs bg-secondary/40 border-border/80"
                  />
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="py-2 px-3 rounded-lg text-xs">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={pending}
                className="w-full h-9 rounded-lg font-medium bg-brand hover:bg-brand-strong text-white text-xs shadow-xs cursor-pointer"
              >
                {pending ? "Sending link…" : "Send Reset Link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
