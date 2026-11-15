"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Lock, Mail, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { authApi } from "@/lib/auth-api"
import { orgApi } from "@/lib/org-api"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useUIStore } from "@/lib/stores/ui-store"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const { setCurrentOrgId } = useUIStore()

  const [showPassword, setShowPassword] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const res = await authApi.login({
        email: values.email,
        password: values.password,
      })

      const token = res.access_token || res.data?.refresh_token || ""
      const user = res.data.user

      setAuth(token, user)

      // Check user organizations to direct to workspace or org onboarding
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
        // If org listing fails or user has none yet
        router.push("/onboarding/organization")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("An unexpected error occurred during sign in.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
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

  return (
    <Card className="border-border bg-surface shadow-2xl">
      <CardHeader className="space-y-1.5 pb-6 border-b border-border-subtle">
        <CardTitle className="text-xl font-heading font-bold text-foreground">
          Sign In
        </CardTitle>
        <CardDescription className="text-xs text-foreground-muted">
          Access your API telemetry, load test runner, and capacity benchmarks.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-mono text-foreground-muted">
              Work Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="email"
                type="email"
                placeholder="developer@company.com"
                className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                disabled={isSubmitting}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] font-mono text-danger">{errors.email.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-mono text-foreground-muted">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-[11px] font-mono text-sand hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                className="pl-9 pr-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                disabled={isSubmitting}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-foreground-subtle hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] font-mono text-danger">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand text-white hover:bg-brand-hover text-xs font-mono h-10 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Dashboard</span>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border-subtle" />
          </div>
          <span className="relative bg-surface px-3 text-[10px] uppercase font-mono text-foreground-subtle">
            Or Continue With
          </span>
        </div>

        {/* Google SSO Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={isOAuthLoading || isSubmitting}
          className="w-full h-10 border-border-subtle hover:bg-surface-raised text-xs font-mono gap-2"
        >
          {isOAuthLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
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
          )}
          <span>Sign In with Google</span>
        </Button>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-border-subtle py-4">
        <p className="text-xs text-foreground-muted font-mono">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-sand font-semibold hover:underline">
            Create account
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
