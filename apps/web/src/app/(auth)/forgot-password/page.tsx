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
    <Card className="border border-border/80 shadow-md rounded-2xl bg-card">
      <CardHeader className="space-y-1.5 pb-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-3" /> Back to sign in
        </Link>
        <CardTitle className="text-2xl font-bold tracking-tight">Reset your password</CardTitle>
        <CardDescription className="text-xs">
          Enter your work email address and we'll send you instructions to recover your account.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {sent ? (
          <div className="space-y-4 text-center py-4">
            <div className="size-12 rounded-full bg-brand-lime/20 text-brand-lime flex items-center justify-center mx-auto">
              <CheckCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold">Check your inbox</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>, a secure password reset link has been dispatched.
              </p>
            </div>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 rounded-full w-full text-xs font-semibold inline-flex items-center justify-center",
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
                  className="h-10 rounded-full pl-10 pr-4 text-xs bg-secondary/40 border-border/80 focus:bg-card"
                />
                <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground pointer-events-none" />
              </div>
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
              {pending ? "Sending link…" : "Send Reset Instructions"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
