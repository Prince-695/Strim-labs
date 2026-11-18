"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Mail } from "lucide-react"

import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { authApi } from "@/lib/auth-api"

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid work email address"),
})

type ForgotFormValues = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSent, setIsSent] = React.useState(false)
  const [submittedEmail, setSubmittedEmail] = React.useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = async (values: ForgotFormValues) => {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      await authApi.forgotPassword(values.email)
      setSubmittedEmail(values.email)
      setIsSent(true)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to send password reset code. Please try again.")
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
            RECOVERY
          </span>
        </div>
        <h1 className="font-mono text-2xl sm:text-3xl font-normal text-foreground tracking-tight">
          Forgot password?
        </h1>
        <p className="mt-2 font-sans text-xs text-foreground-muted leading-relaxed">
          Enter your email address and we&apos;ll send a 6-digit verification code to reset your credentials.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-danger/50 bg-danger/10 p-3 text-xs text-danger font-mono">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-danger" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {isSent ? (
        <div className="space-y-4 font-mono text-xs">
          <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success/10 p-3.5 text-xs text-success">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Verification code dispatched</p>
              <p className="mt-1 text-foreground-muted text-[11px] font-sans leading-relaxed">
                We sent a 6-digit OTP code to <span className="text-sand font-mono">{submittedEmail}</span>. Enter the code on the next screen to choose your new password.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/reset-password?email=${encodeURIComponent(submittedEmail)}`)}
            className="w-full rounded-md bg-brand hover:bg-brand-hover py-2.5 px-4 font-mono text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-brand/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span>ENTER CODE &amp; RESET →</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-mono text-xs">
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-brand hover:bg-brand-hover disabled:opacity-50 py-2.5 px-4 font-mono text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-brand/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                <span>DISPATCHING CODE...</span>
              </span>
            ) : (
              "SEND RESET CODE →"
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
