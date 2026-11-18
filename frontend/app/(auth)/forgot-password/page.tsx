"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Mail,
} from "lucide-react"

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
    <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-7 text-left shadow-xl shadow-black sm:max-w-md sm:p-9">
      <CornerCrosshairs colorClass="text-sand/30" />

      {/* Metadata Tag & Title */}
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
            RECOVERY
          </span>
        </div>
        <h1 className="font-mono text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
          Forgot password?
        </h1>
        <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
          Enter your email address and we&apos;ll send a 6-digit verification
          code to reset your credentials.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-danger/50 bg-danger/10 p-3 font-mono text-xs text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {isSent ? (
        <div className="space-y-4 font-mono text-xs">
          <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success/10 p-3.5 text-xs text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                Verification code dispatched
              </p>
              <p className="mt-1 font-sans text-[11px] leading-relaxed text-foreground-muted">
                We sent a 6-digit OTP code to{" "}
                <span className="font-mono text-sand">{submittedEmail}</span>.
                Enter the code on the next screen to choose your new password.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/reset-password?email=${encodeURIComponent(submittedEmail)}`
              )
            }
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-mono text-xs font-semibold tracking-wider text-white uppercase shadow-md shadow-brand/20 transition-all hover:bg-brand-hover"
          >
            <span>ENTER CODE &amp; RESET →</span>
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 font-mono text-xs"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[11px] tracking-wider text-sand uppercase"
            >
              Work email
            </label>
            <input
              id="email"
              type="email"
              placeholder="developer@company.com"
              disabled={isSubmitting}
              className="w-full rounded-md border border-border bg-surface-sunken px-3 py-2 text-xs text-foreground transition-colors placeholder:text-foreground-subtle focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-danger">
                {errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-mono text-xs font-semibold tracking-wider text-white uppercase shadow-md shadow-brand/20 transition-all hover:bg-brand-hover disabled:opacity-50"
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
      <div className="mt-7 border-t border-border-subtle pt-5 text-center font-mono text-xs text-foreground-subtle">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sand transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </div>
  )
}
