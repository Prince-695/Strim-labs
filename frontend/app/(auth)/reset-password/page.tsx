"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Lock, Mail, KeyRound, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { authApi } from "@/lib/auth-api"

const resetSchema = z
  .object({
    email: z.string().email("Please enter a valid work email address"),
    otp: z.string().length(6, "Verification code must be exactly 6 digits"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type ResetFormValues = z.infer<typeof resetSchema>

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get("email") || ""

  const [showPassword, setShowPassword] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: emailParam,
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  React.useEffect(() => {
    if (emailParam) {
      setValue("email", emailParam)
    }
  }, [emailParam, setValue])

  const onSubmit = async (values: ResetFormValues) => {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      await authApi.resetPassword({
        email: values.email,
        otp: values.otp,
        new_password: values.newPassword,
      })

      setIsSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 2500)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to reset password. Please check your verification code.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-border bg-surface shadow-2xl">
      <CardHeader className="space-y-1.5 pb-6 border-b border-border-subtle">
        <CardTitle className="text-xl font-heading font-bold text-foreground">
          Set New Password
        </CardTitle>
        <CardDescription className="text-xs text-foreground-muted">
          Enter the 6-digit OTP code and choose your new secure password.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-xs text-success">
            <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Password reset successfully!</p>
              <p className="mt-1 text-foreground-muted font-mono text-[11px]">
                Redirecting you to the sign-in page...
              </p>
            </div>
          </div>
        ) : (
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
                  placeholder="developer@acme.com"
                  className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                  disabled={isSubmitting}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] font-mono text-danger">{errors.email.message}</p>
              )}
            </div>

            {/* OTP Code */}
            <div className="space-y-1.5">
              <Label htmlFor="otp" className="text-xs font-mono text-foreground-muted">
                6-Digit Verification Code
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
                <Input
                  id="otp"
                  maxLength={6}
                  placeholder="123456"
                  className="pl-9 text-xs font-mono tracking-widest bg-surface-raised border-border-subtle focus-visible:border-brand"
                  disabled={isSubmitting}
                  {...register("otp")}
                />
              </div>
              {errors.otp && (
                <p className="text-[11px] font-mono text-danger">{errors.otp.message}</p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-xs font-mono text-foreground-muted">
                New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className="pl-9 pr-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                  disabled={isSubmitting}
                  {...register("newPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-foreground-subtle hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-[11px] font-mono text-danger">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-mono text-foreground-muted">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                  disabled={isSubmitting}
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] font-mono text-danger">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand text-white hover:bg-brand-hover text-xs font-mono h-10 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Reset Password & Sign In</span>
              )}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex justify-center border-t border-border-subtle py-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Sign In</span>
        </Link>
      </CardFooter>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="text-center font-mono text-xs text-foreground-subtle">Loading...</div>}>
      <ResetPasswordContent />
    </React.Suspense>
  )
}
