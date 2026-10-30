"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await fetchApi("/api/v1/organizations/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setSuccess(true);
      setTimeout(() => {
        router.push("/app");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to accept organization invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl text-center space-y-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Building2 className="size-6" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Organization Invitation
          </h1>
          <p className="text-xs text-muted-foreground">
            You have been invited to collaborate on an engineering organization in STRIM Labs.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500">
            {error}
          </div>
        )}

        {success ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-2">
            <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
            <p className="text-xs font-semibold text-emerald-500">Invitation accepted! Redirecting...</p>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {isReady && !isAuthenticated ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Please sign in or create an account to accept this invitation.
                </p>
                <Button asChild className="w-full bg-brand text-brand-foreground hover:bg-brand-strong">
                  <Link href={`/sign-in?redirect=/invite/${token}`}>Sign In to Accept</Link>
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleAccept}
                disabled={loading}
                className="w-full bg-brand text-brand-foreground hover:bg-brand-strong font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation & Join Team"
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
