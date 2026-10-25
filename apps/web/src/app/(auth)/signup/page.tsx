"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Org } from "@/lib/types";
import { hasErrors, validateEmail, validatePassword, validateRequired, type FieldErrors } from "@/lib/validation";

type Keys = "name" | "email" | "organizationName" | "password";

export default function SignupPage() {
  const router = useRouter();
  const { setSession } = useSession();
  const [v, setV] = useState({ name: "", email: "", organizationName: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<Keys>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: Keys) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const err = (k: Keys) => ({ "aria-invalid": Boolean(errors[k]), "aria-describedby": errors[k] ? `${k}-error` : undefined });

  async function submit() {
    const e: FieldErrors<Keys> = {
      name: validateRequired(v.name, "your full name"),
      email: validateEmail(v.email),
      organizationName: validateRequired(v.organizationName, "an organisation name"),
      password: validatePassword(v.password, 8),
    };
    setErrors(e);
    setFormError(null);
    if (hasErrors(e)) return;
    setLoading(true);
    try {
      const res = await api<{ token: string; orgs: Org[] }>("/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name: v.name.trim(), email: v.email.trim(), password: v.password, organizationName: v.organizationName.trim() }),
      });
      setSession(res.token, res.orgs);
      router.replace("/dashboard");
    } catch (er) {
      if (er instanceof ApiError && er.status === 409) setErrors({ email: "An account with this email may already exist. Try signing in instead." });
      else setFormError(er instanceof ApiError ? er.message : "Couldn't create your workspace. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Create your workspace</h1>
        <p className="text-sm text-muted-foreground">Add an API and run your first test in about a minute.</p>
      </div>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {formError && (
          <Alert tone="danger" title="Couldn't create the workspace">
            {formError}
          </Alert>
        )}
        <Field id="name" label="Full name" error={errors.name}>
          <Input id="name" autoComplete="name" value={v.name} onChange={set("name")} {...err("name")} />
        </Field>
        <Field id="email" label="Work email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={v.email} onChange={set("email")} placeholder="you@company.com" {...err("email")} />
        </Field>
        <Field id="organizationName" label="Organisation name" error={errors.organizationName} hint="This becomes your workspace name.">
          <Input id="organizationName" autoComplete="organization" value={v.organizationName} onChange={set("organizationName")} {...err("organizationName")} />
        </Field>
        <Field id="password" label="Password" error={errors.password} hint="At least 8 characters.">
          <PasswordInput id="password" autoComplete="new-password" value={v.password} onChange={set("password")} {...err("password")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create workspace
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">STRIM sends real traffic. Only test endpoints you own or have permission to test.</p>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-strong hover:underline dark:text-brand">
          Sign in
        </Link>
      </p>
    </div>
  );
}
