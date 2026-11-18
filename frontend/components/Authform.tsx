"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { authApi } from "@/lib/auth-api"
import { orgApi } from "@/lib/org-api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useUIStore } from "@/lib/stores/ui-store"

export interface AuthformProps {
  type: "login" | "signup"
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 262" {...props}>
      <path
        fill="#4285f4"
        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
      />
      <path
        fill="#34a853"
        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
      />
      <path
        fill="#fbbc05"
        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
      />
      <path
        fill="#eb4335"
        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
      />
    </svg>
  )
}

function AuthformContent({ type }: AuthformProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get("error")
  const { setAuth } = useAuthStore()
  const { setCurrentOrgId } = useUIStore()

  const isLogin = type === "login"

  // Form states
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      if (isLogin) {
        // Handle Login
        const res = await authApi.login({
          email: email.trim(),
          password,
        })

        const token = res.access_token || res.data?.refresh_token || ""
        const user = res.data.user
        setAuth(token, user)

        // Check if user belongs to an organization
        try {
          const orgsRes = await orgApi.list()
          const orgs = orgsRes.data || []
          if (orgs.length > 0) {
            setCurrentOrgId(orgs[0].id)
            router.push("/dashboard")
          } else {
            router.push("/onboarding/organization")
          }
        } catch {
          router.push("/onboarding/organization")
        }
      } else {
        // Handle Signup
        const res = await authApi.signup({
          first_name: firstName.trim() || "User",
          last_name: lastName.trim() || "Account",
          email: email.trim(),
          password,
        })

        const token = res.access_token || res.data?.refresh_token || ""
        const user = res.data.user
        setAuth(token, user)

        router.push("/onboarding/organization")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(
          `An unexpected error occurred during ${isLogin ? "sign in" : "sign up"}.`
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleAuth = async () => {
    try {
      setIsOAuthLoading(true)
      setErrorMessage(null)
      const res = await authApi.getGoogleOAuthUrl()
      if (res.data?.url) {
        window.location.href = res.data.url
      }
    } catch (err: unknown) {
      setIsOAuthLoading(false)
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to initiate Google authentication.")
      }
    }
  }

  const handleGithubAuth = async () => {
    try {
      setIsOAuthLoading(true)
      setErrorMessage(null)
      window.location.href = "/api/auth/github"
    } catch {
      setIsOAuthLoading(false)
      setErrorMessage("GitHub authentication is not currently available.")
    }
  }

  return (
    <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-7 text-left shadow-xl shadow-black sm:max-w-md sm:p-9">
      <CornerCrosshairs colorClass="text-sand/30" />

      {/* Brand Logo & Portal Header */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised p-1 transition-colors group-hover:border-brand">
              <Image
                src="/logo.png"
                alt="Strim Labs Logo"
                width={28}
                height={28}
                priority
                className="size-full object-contain"
              />
            </div>
            <span className="font-mono text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-brand">
              STRIM LABS
            </span>
          </Link>
          <span className="flex items-center gap-1.5 rounded border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" />
            {isLogin ? "SIGN IN" : "SIGN UP"}
          </span>
        </div>
        <h1 className="font-mono text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
          {isLogin ? "Sign in to Strim-Labs" : "Create your account"}
        </h1>
        <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
          {isLogin
            ? "Access your automated API discovery, load testing, and live monitoring cockpit."
            : "Get started with high-concurrency API performance testing in seconds."}
        </p>
      </div>

      {/* Error Alert Banner */}
      {(errorMessage || urlError) && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-danger/50 bg-danger/10 p-3 font-mono text-xs text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span className="leading-relaxed">{errorMessage || urlError}</span>
        </div>
      )}

      {/* Main Credentials Form */}
      <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
        {/* Name Fields for Signup */}
        {!isLogin && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="firstName"
                className="block text-[11px] tracking-wider text-sand uppercase"
              >
                First name
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-foreground transition-colors placeholder:text-foreground-subtle focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="lastName"
                className="block text-[11px] tracking-wider text-sand uppercase"
              >
                Last name
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-foreground transition-colors placeholder:text-foreground-subtle focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-[11px] tracking-wider text-sand uppercase"
          >
            Work email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-foreground transition-colors placeholder:text-foreground-subtle focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
          />
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-[11px] tracking-wider text-sand uppercase"
            >
              Password
            </label>
            {isLogin && (
              <Link
                href="/forgot-password"
                className="font-sans text-[11px] text-foreground-subtle transition-colors hover:text-sand"
              >
                Forgot?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              placeholder={isLogin ? "••••••••" : "Min. 8 characters"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLogin ? 1 : 8}
              className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 pr-9 text-xs text-foreground transition-colors placeholder:text-foreground-subtle focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-foreground-subtle transition-colors hover:text-sand"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={isSubmitting || isOAuthLoading}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-mono text-xs font-semibold tracking-wider text-white uppercase shadow-md shadow-brand/20 transition-all hover:bg-brand-hover disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              <span>AUTHENTICATING...</span>
            </span>
          ) : isLogin ? (
            "CONTINUE →"
          ) : (
            "CREATE FREE ACCOUNT →"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <span className="relative bg-surface px-3 font-mono text-[10px] tracking-wider text-foreground-subtle uppercase">
          OR CONTINUE WITH
        </span>
      </div>

      {/* Social OAuth Buttons in STRIM dark palette */}

      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={isSubmitting || isOAuthLoading}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-sand transition-colors hover:border-border hover:bg-surface-hover"
      >
        <GoogleIcon className="size-3.5 shrink-0" />
        <span>Google</span>
      </button>

      {/* Switcher Footer */}
      <div className="mt-7 border-t border-border-subtle pt-5 text-center font-mono text-xs text-foreground-subtle">
        {isLogin ? (
          <span>
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-brand transition-colors hover:underline"
            >
              Sign up →
            </Link>
          </span>
        ) : (
          <span>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-brand transition-colors hover:underline"
            >
              Sign in →
            </Link>
          </span>
        )}
      </div>
    </div>
  )
}

export function Authform(props: AuthformProps) {
  return (
    <React.Suspense
      fallback={
        <div className="h-[450px] w-full max-w-sm animate-pulse rounded-xl border border-border bg-surface sm:max-w-md" />
      }
    >
      <AuthformContent {...props} />
    </React.Suspense>
  )
}
