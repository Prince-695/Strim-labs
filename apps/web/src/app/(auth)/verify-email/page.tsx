"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setErrorMessage("No verification token was provided in the URL.");
      return;
    }

    async function verify() {
      try {
        await fetchApi("/api/v1/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        setSuccess(true);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to verify email. The token may be expired or invalid.");
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <Loader2 className="mx-auto size-8 animate-spin text-brand" />
        <p className="text-sm text-muted-foreground font-medium">Verifying your email address...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">Email Verified</h2>
          <p className="text-xs text-muted-foreground">
            Your email address has been successfully confirmed. Your account is fully active.
          </p>
        </div>
        <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand-strong">
          <Link href="/sign-in">Proceed to Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-rose-500/20 bg-rose-500/5 p-8 text-center space-y-4">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Verification Failed</h2>
        <p className="text-xs text-rose-500 leading-relaxed">{errorMessage}</p>
      </div>
      <Button asChild variant="outline" className="w-full text-xs">
        <Link href="/sign-in">Return to Sign In</Link>
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
