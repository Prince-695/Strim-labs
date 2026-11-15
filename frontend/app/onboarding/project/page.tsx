"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Server, Globe, Link2, ShieldAlert, Loader2, AlertCircle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { projectApi, type ProjectEnvironment } from "@/lib/project-api"
import { orgApi } from "@/lib/org-api"
import { useUIStore } from "@/lib/stores/ui-store"

const createProjectSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  baseUrl: z
    .string()
    .url("Please enter a valid target URL (e.g. https://api.yourdomain.com)")
    .refine((url) => url.startsWith("https://") || url.startsWith("http://"), {
      message: "Target URL must begin with https:// or http://",
    }),
  environment: z.enum(["development", "staging", "production"] as const),
  authorized: z.boolean().refine((val) => val === true, {
    message: "You must confirm authorization before proceeding",
  }),
})

type CreateProjectFormValues = z.infer<typeof createProjectSchema>

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export default function OnboardingProjectPage() {
  const router = useRouter()
  const { currentOrgId, setCurrentOrgId, setCurrentProjectId } = useUIStore()

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isManualSlug, setIsManualSlug] = React.useState(false)
  const [activeOrgId, setActiveOrgId] = React.useState<string>(currentOrgId || "")

  // Ensure an org ID is resolved
  React.useEffect(() => {
    const resolveOrg = async () => {
      if (!activeOrgId) {
        try {
          const res = await orgApi.list()
          const orgs = res.data || []
          if (orgs.length > 0) {
            setActiveOrgId(orgs[0].id)
            setCurrentOrgId(orgs[0].id)
          } else {
            router.push("/onboarding/organization")
          }
        } catch {
          router.push("/onboarding/organization")
        }
      }
    }
    resolveOrg()
  }, [activeOrgId, router, setCurrentOrgId])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      slug: "",
      baseUrl: "",
      environment: "staging",
      authorized: false,
    },
  })

  const projectName = watch("name")
  const selectedEnv = watch("environment")

  React.useEffect(() => {
    if (!isManualSlug && projectName) {
      setValue("slug", slugify(projectName), { shouldValidate: true })
    }
  }, [projectName, isManualSlug, setValue])

  const onSubmit = async (values: CreateProjectFormValues) => {
    if (!activeOrgId) {
      setErrorMessage("No active organization found. Please create an organization first.")
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const res = await projectApi.create(activeOrgId, {
        name: values.name,
        slug: values.slug,
        base_url: values.baseUrl,
        environment: values.environment as ProjectEnvironment,
      })

      if (res.data?.id) {
        setCurrentProjectId(res.data.id)
        router.push(`/dashboard/projects/${res.data.id}/verification`)
      } else {
        router.push("/dashboard")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to create project target. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-border bg-surface shadow-2xl">
      <CardHeader className="space-y-2 pb-6 border-b border-border-subtle">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 font-mono text-[11px] text-brand">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand/20 text-brand font-bold">
            2
          </span>
          <span>STEP 2 OF 2: REGISTER TARGET API</span>
        </div>

        <CardTitle className="text-xl font-heading font-bold text-foreground">
          Register Target API Project
        </CardTitle>
        <CardDescription className="text-xs text-foreground-muted">
          Configure the API endpoint URL you will be observing, probing, and load testing.
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
          {/* Project Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-mono text-foreground-muted">
              Project Name
            </Label>
            <div className="relative">
              <Server className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="name"
                placeholder="Checkout API"
                className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                disabled={isSubmitting}
                {...register("name")}
              />
            </div>
            {errors.name && (
              <p className="text-[11px] font-mono text-danger">{errors.name.message}</p>
            )}
          </div>

          {/* Project Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-xs font-mono text-foreground-muted">
              Project Slug
            </Label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="slug"
                placeholder="checkout-api"
                className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                disabled={isSubmitting}
                {...register("slug", {
                  onChange: () => setIsManualSlug(true),
                })}
              />
            </div>
            {errors.slug && (
              <p className="text-[11px] font-mono text-danger">{errors.slug.message}</p>
            )}
          </div>

          {/* Target Base URL */}
          <div className="space-y-1.5">
            <Label htmlFor="baseUrl" className="text-xs font-mono text-foreground-muted">
              Target API Base URL
            </Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="baseUrl"
                type="url"
                placeholder="https://api.yourdomain.com"
                className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                disabled={isSubmitting}
                {...register("baseUrl")}
              />
            </div>
            {errors.baseUrl && (
              <p className="text-[11px] font-mono text-danger">{errors.baseUrl.message}</p>
            )}
            <p className="text-[10px] font-mono text-foreground-subtle">
              Netguard SSRF protection verifies this domain before high-volume distributed runs.
            </p>
          </div>

          {/* Environment Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono text-foreground-muted">
              Environment
            </Label>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              {(["development", "staging", "production"] as const).map((env) => (
                <button
                  type="button"
                  key={env}
                  onClick={() => setValue("environment", env)}
                  className={`rounded-lg border p-2.5 text-center capitalize transition-colors ${
                    selectedEnv === env
                      ? "border-brand bg-brand/10 text-white font-medium"
                      : "border-border-subtle bg-surface-raised text-foreground-subtle hover:text-foreground"
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>

          {/* Safety Acknowledgement */}
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
            <div className="flex items-start gap-2 text-warning font-mono text-xs font-semibold">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <span>Target Authorization Guarantee</span>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-border-subtle bg-surface-raised text-brand focus:ring-brand"
                {...register("authorized")}
              />
              <span className="text-[11px] font-mono text-foreground-muted leading-tight">
                I certify that I own or have written authorization to load test this target endpoint.
              </span>
            </label>
            {errors.authorized && (
              <p className="text-[11px] font-mono text-danger pl-6">{errors.authorized.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand text-white hover:bg-brand-hover text-xs font-mono h-10 mt-2 gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Registering Project Target...</span>
              </>
            ) : (
              <>
                <span>Complete Onboarding & Verify</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
