"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { sleep } from "@/lib/utils";
import { validateEmail } from "@/lib/validation";

/**
 * The backend has no reset endpoint in the current contract, so this page shows the neutral confirmation state
 * without sending anything. Wire it to POST /v1/auth/forgot-password when that exists.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const e = validateEmail(email);
    setError(e);
    if (e) return;
    setLoading(true);
    await sleep(700);
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-subtle text-brand-strong dark:text-brand">
          <MailCheck className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Check your inbox</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is on its way. It can take a few minutes.
          </p>
        </div>
        <Link href="/login" className={buttonVariants({ variant: "outline", className: "w-full" })}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter your email and we'll send a link to choose a new one.</p>
      </div>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field id="email" label="Work email" error={error}>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? "email-error" : undefined} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-brand-strong hover:underline dark:text-brand">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
