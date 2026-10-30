"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { fetchApi, type Schemas } from "@/lib/api";

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid work email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  organizationName: z.string().min(2, "Organization name must be at least 2 characters"),
});

type SignUpValues = z.infer<typeof signUpSchema>;

function SignUpForm() {
  const router = useRouter();
  const { setSession, isAuthenticated, isReady } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace("/onboarding");
    }
  }, [isReady, isAuthenticated, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      organizationName: "",
    },
  });

  const onSubmit = async (values: SignUpValues) => {
    setServerError(null);
    try {
      const response = await fetchApi<Schemas["AuthResponse"]>("/api/v1/auth/sign-up", {
        method: "POST",
        body: JSON.stringify(values),
      });

      setSession(response.accessToken, response.user);
      router.replace("/onboarding");
    } catch (err: any) {
      setServerError(err.message || "Failed to create account. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1.5 text-center sm:text-left">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your STRIM Labs account</h1>
        <p className="text-sm text-muted-foreground">
          Deploy continuous API observability and distributed load testing for your team.
        </p>
      </div>

      {serverError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 leading-relaxed">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="Priya Sharma"
            autoComplete="name"
            disabled={isSubmitting}
            {...register("name")}
            className={errors.name ? "border-rose-500" : ""}
          />
          {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="developer@acme.com"
            autoComplete="email"
            disabled={isSubmitting}
            {...register("email")}
            className={errors.email ? "border-rose-500" : ""}
          />
          {errors.email && <p className="text-xs text-rose-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="organizationName">Organization Name</Label>
          <div className="relative">
            <Input
              id="organizationName"
              placeholder="Acme Engineering"
              disabled={isSubmitting}
              {...register("organizationName")}
              className={errors.organizationName ? "border-rose-500 pl-8" : "pl-8"}
            />
            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          </div>
          {errors.organizationName && (
            <p className="text-xs text-rose-500">{errors.organizationName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 chars, 1 uppercase, 1 number"
            autoComplete="new-password"
            disabled={isSubmitting}
            {...register("password")}
            className={errors.password ? "border-rose-500" : ""}
          />
          {errors.password && <p className="text-xs text-rose-500">{errors.password.message}</p>}
        </div>

        <div className="space-y-2 pt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>Includes 1,000,000 free telemetry events / month</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            <span>Automated breaking point detection engine</span>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-brand text-brand-foreground hover:bg-brand-strong font-medium mt-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating Organization...
            </>
          ) : (
            <>
              Create Account
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        By registering, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading sign up...</div>}>
      <SignUpForm />
    </Suspense>
  );
}
