"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
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
    <Card className="border-border bg-surface shadow-2xl">
      <CardHeader className="space-y-1.5 pb-6 border-b border-border-subtle">
        <CardTitle className="text-xl font-heading font-bold text-foreground">
          Reset Password
        </CardTitle>
        <CardDescription className="text-xs text-foreground-muted">
          Enter your email and we&apos;ll dispatch a 6-digit verification code.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {isSent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-3.5 text-xs text-success">
              <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Verification code dispatched</p>
                <p className="mt-1 text-foreground-muted font-mono text-[11px]">
                  We sent an OTP to <span className="text-sand">{submittedEmail}</span>. Enter the code to choose a new password.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => router.push(`/reset-password?email=${encodeURIComponent(submittedEmail)}`)}
              className="w-full bg-brand text-white hover:bg-brand-hover text-xs font-mono h-10"
            >
              Enter Verification Code & Reset
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand text-white hover:bg-brand-hover text-xs font-mono h-10 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  <span>Dispatching Code...</span>
                </>
              ) : (
                <span>Send Reset Code</span>
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
