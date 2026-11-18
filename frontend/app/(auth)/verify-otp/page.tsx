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
  RefreshCw,
} from "lucide-react"

import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { OtpInput } from "@/components/auth/otp-input"
import { authApi } from "@/lib/auth-api"

const verifySchema = z.object({
  otp: z.string().length(6, "Verification code must be exactly 6 digits"),
})

type VerifyFormValues = z.infer<typeof verifySchema>

export default function VerifyOtpPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [resendStatus, setResendStatus] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isResending, setIsResending] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { otp: "" },
  })

  const otpValue = watch("otp")

  const onSubmit = async (values: VerifyFormValues) => {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      await authApi.verifyOtp(values.otp)
      setIsSuccess(true)
      setTimeout(() => {
        router.push("/onboarding/organization")
      }, 1500)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(
          "Failed to verify code. Please verify the 6 digits and try again."
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    try {
      setIsResending(true)
      setResendStatus(null)
      await authApi.sendOtp()
      setResendStatus("A new 6-digit code has been dispatched to your email.")
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to resend code.")
      }
    } finally {
      setIsResending(false)
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
            2FA CODE
          </span>
        </div>
        <h1 className="font-mono text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
          Verify your account
        </h1>
        <p className="mt-2 font-sans text-xs leading-relaxed text-foreground-muted">
          Enter the 6-digit verification code sent to your registered email
          inbox to complete authentication.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-danger/50 bg-danger/10 p-3 font-mono text-xs text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* Resend Status */}
      {resendStatus && (
        <div className="mb-5 flex items-start gap-2.5 rounded-md border border-success/40 bg-success/10 p-3 font-mono text-xs text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span className="leading-relaxed">{resendStatus}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="space-y-4 font-mono text-xs">
          <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success/10 p-3.5 text-xs text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                Account verified successfully!
              </p>
              <p className="mt-1 font-sans text-[11px] leading-relaxed text-foreground-muted">
                Loading your organization setup workspace...
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 font-mono text-xs"
        >
          <div className="space-y-2">
            <label className="block font-mono text-[11px] tracking-wider text-sand uppercase">
              6-Digit verification code
            </label>
            <OtpInput
              value={otpValue}
              onChange={(val) => {
                setValue("otp", val, { shouldValidate: val.length === 6 })
                setErrorMessage(null)
              }}
              disabled={isSubmitting}
              hasError={Boolean(errors.otp)}
              autoFocus={true}
            />
            {errors.otp && (
              <p className="mt-1 text-[11px] text-danger">
                {errors.otp.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || otpValue.length !== 6}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 font-mono text-xs font-semibold tracking-wider text-white uppercase shadow-md shadow-brand/20 transition-all hover:bg-brand-hover disabled:opacity-40"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                <span>VERIFYING CODE...</span>
              </span>
            ) : (
              "VERIFY & CONTINUE →"
            )}
          </button>
        </form>
      )}

      {/* Resend Link */}
      <div className="mt-5 text-center font-mono text-xs">
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || isSubmitting}
          className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground-subtle transition-colors hover:text-sand disabled:opacity-50"
        >
          {isResending ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              <span>Dispatching new code...</span>
            </>
          ) : (
            <>
              <RefreshCw className="size-3" />
              <span>Didn&apos;t receive a code? Click to resend</span>
            </>
          )}
        </button>
      </div>

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
