"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react"

import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
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
      }, 2000)
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
    <div className="w-full max-w-sm sm:max-w-md relative rounded-xl border border-border bg-surface p-7 sm:p-9 shadow-xl shadow-black text-left">
      <CornerCrosshairs colorClass="text-sand/30" />

      {/* Metadata Tag & Title */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised p-1 overflow-hidden group-hover:border-brand transition-colors">
              <Image
                src="/logo.png"
                alt="Strim Labs Logo"
                width={28}
                height={28}
                priority
                className="size-full object-contain"
              />
            </div>
            <span className="font-mono text-sm font-bold tracking-tight text-foreground group-hover:text-brand transition-colors">
              STRIM LABS
            </span>
          </Link>
          <span className="text-brand font-mono text-[11px] font-semibold flex items-center gap-1.5 border border-brand/30 bg-brand/10 px-2 py-0.5 rounded">
            <span className="size-1.5 rounded-full bg-brand animate-pulse" />
            PASSWORD RESET
          </span>
        </div>
        <h1 className="font-mono text-2xl sm:text-3xl font-normal text-foreground tracking-tight">
          Set new password
        </h1>
        <p className="mt-2 font-sans text-xs text-foreground-muted leading-relaxed">
          Enter the 6-digit verification code sent to your inbox and select a new secure password.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-danger/50 bg-danger/10 p-3 text-xs text-danger font-mono">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-danger" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4 font-mono text-xs">
          <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success/10 p-3.5 text-xs text-success">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Password reset successfully!</p>
              <p className="mt-1 text-foreground-muted text-[11px] font-sans leading-relaxed">
                Your credentials have been updated. Redirecting you to sign in...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-mono text-xs">
          {/* Email Field */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[11px] text-sand uppercase tracking-wider block">
              Work email
            </label>
            <input
              id="email"
              type="email"
              placeholder="developer@company.com"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-foreground placeholder:text-foreground-subtle focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand transition-colors"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-[11px] text-danger mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* OTP Code */}
          <div className="space-y-1.5">
            <label htmlFor="otp" className="text-[11px] text-sand uppercase tracking-wider block">
              6-Digit verification code
            </label>
            <input
              id="otp"
              type="text"
              maxLength={6}
              placeholder="123456"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs font-mono tracking-widest text-foreground placeholder:text-foreground-subtle focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand transition-colors"
              {...register("otp")}
            />
            {errors.otp && (
              <p className="text-[11px] text-danger mt-1">{errors.otp.message}</p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="text-[11px] text-sand uppercase tracking-wider block">
              New password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 pr-9 text-xs text-foreground placeholder:text-foreground-subtle focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand transition-colors"
                {...register("newPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-sand transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-[11px] text-danger mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-[11px] text-sand uppercase tracking-wider block">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter password"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-foreground placeholder:text-foreground-subtle focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand transition-colors"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-[11px] text-danger mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-brand hover:bg-brand-hover disabled:opacity-50 py-2.5 px-4 font-mono text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-brand/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                <span>UPDATING CREDENTIALS...</span>
              </span>
            ) : (
              "RESET PASSWORD & SIGN IN →"
            )}
          </button>
        </form>
      )}

      {/* Switcher Footer */}
      <div className="mt-7 pt-5 border-t border-border-subtle text-center font-mono text-xs text-foreground-subtle">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sand hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3" />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="text-center font-mono text-xs text-foreground-subtle">Loading...</div>}>
      <ResetPasswordContent />
    </React.Suspense>
  )
}
