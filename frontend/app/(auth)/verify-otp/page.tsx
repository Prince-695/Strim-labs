"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ShieldCheck, KeyRound, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
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
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { otp: "" },
  })

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
        setErrorMessage("Failed to verify code. Please verify the 6 digits and try again.")
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
      setResendStatus("New code dispatched to your registered email.")
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
    <Card className="border-border bg-surface shadow-2xl">
      <CardHeader className="space-y-1.5 pb-6 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand" />
          <CardTitle className="text-xl font-heading font-bold text-foreground">
            Verify Email
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-foreground-muted">
          Enter the 6-digit verification code sent to your email inbox.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {resendStatus && (
          <div className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{resendStatus}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-xs text-success">
            <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Email verified successfully!</p>
              <p className="mt-1 text-foreground-muted font-mono text-[11px]">
                Redirecting to workspace onboarding...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  className="pl-9 text-center tracking-[0.4em] font-mono text-sm bg-surface-raised border-border-subtle focus-visible:border-brand"
                  disabled={isSubmitting}
                  {...register("otp")}
                />
              </div>
              {errors.otp && (
                <p className="text-[11px] font-mono text-danger">{errors.otp.message}</p>
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
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Confirm Verification Code</span>
              )}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-xs font-mono text-sand hover:underline disabled:opacity-50"
              >
                {isResending ? "Dispatching new code..." : "Didn't receive code? Resend OTP"}
              </button>
            </div>
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
