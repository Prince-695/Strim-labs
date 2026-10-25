"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { DEMO_PERSONA } from "@/lib/presets";
import { useSession } from "@/lib/session";
import type { Org } from "@/lib/types";
import { hasErrors, validateEmail, validatePassword, type FieldErrors } from "@/lib/validation";

/** Only same-origin relative paths are allowed as a post-login destination (prevents open redirects). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw === "/") return "/dashboard";
  return raw;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession, token, ready } = useSession();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && token) router.replace(next);
  }, [ready, token, router, next]);

  async function submit() {
    const e = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(e);
    setFormError(null);
    if (hasErrors(e)) return;
    setLoading(true);
    try {
      const res = await api<{ token: string; orgs: Org[]; user: { id: string; email: string; name: string } }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setSession(res.token, res.orgs, res.user);
      router.replace(next);
    } catch (err) {
      // Neutral message: never reveal whether the email is registered.
      setFormError(err instanceof ApiError && (err.status === 0 || err.status >= 500) ? err.message : "That email and password don't match. Check them and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back. Pick up where your last test left off.</p>
      </div>

      <button
        type="button"
        onClick={() => {
          setEmail(DEMO_PERSONA.email);
          setPassword(DEMO_PERSONA.password);
          setErrors({});
        }}
        className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-brand/40 bg-brand-subtle/60 px-4 py-3 text-left transition-colors hover:bg-brand-subtle"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-ink text-brand">
          <Sparkles className="size-4" />
        </span>
        <span className="text-[13px]">
          <span className="font-medium">Try the demo persona</span>
          <span className="block text-muted-foreground">{DEMO_PERSONA.label}. Fills the form; you press Sign in.</span>
        </span>
      </button>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {formError && (
          <Alert tone="danger" title="Couldn't sign you in">
            {formError}
          </Alert>
        )}
        <Field id="email" label="Work email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
        </Field>
        <Field id="password" label="Password" error={errors.password}>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[13px] font-medium text-brand-strong hover:underline dark:text-brand">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to STRIM?{" "}
        <Link href="/signup" className="font-medium text-brand-strong hover:underline dark:text-brand">
          Create a workspace
        </Link>
      </p>
    </div>
  );
}
