"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Building2, Globe, FileText, Loader2, AlertCircle, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { orgApi } from "@/lib/org-api"
import { useUIStore } from "@/lib/stores/ui-store"

const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
})

type CreateOrgFormValues = z.infer<typeof createOrgSchema>

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export default function OnboardingOrgPage() {
  const router = useRouter()
  const { setCurrentOrgId } = useUIStore()

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isManualSlug, setIsManualSlug] = React.useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOrgFormValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
    },
  })

  const orgName = watch("name")

  // Auto-generate slug while typing unless user manually modified it
  React.useEffect(() => {
    if (!isManualSlug && orgName) {
      setValue("slug", slugify(orgName), { shouldValidate: true })
    }
  }, [orgName, isManualSlug, setValue])

  const onSubmit = async (values: CreateOrgFormValues) => {
    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const res = await orgApi.create({
        name: values.name,
        slug: values.slug,
        description: values.description,
      })

      if (res.data?.id) {
        setCurrentOrgId(res.data.id)
        router.push("/onboarding/project")
      } else {
        router.push("/dashboard")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to create organization. Please try again.")
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
            1
          </span>
          <span>STEP 1 OF 2: WORKSPACE PROVISIONING</span>
        </div>

        <CardTitle className="text-xl font-heading font-bold text-foreground">
          Create Organization Workspace
        </CardTitle>
        <CardDescription className="text-xs text-foreground-muted">
          Your organization is the dedicated tenant for your API targets, metrics telemetry, and team members.
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
          {/* Org Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-mono text-foreground-muted">
              Organization Name
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="name"
                placeholder="Acme Engineering"
                className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                disabled={isSubmitting}
                {...register("name")}
              />
            </div>
            {errors.name && (
              <p className="text-[11px] font-mono text-danger">{errors.name.message}</p>
            )}
          </div>

          {/* Org Slug */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug" className="text-xs font-mono text-foreground-muted">
                Workspace URL Identifier (Slug)
              </Label>
              <span className="text-[10px] font-mono text-foreground-subtle">Immutable after creation</span>
            </div>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="slug"
                placeholder="acme-engineering"
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
            <p className="text-[11px] font-mono text-foreground-subtle">
              API routes will be scoped under: <code className="text-sand">/v1/organizations/{watch("slug") || "slug"}/...</code>
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-mono text-foreground-muted">
              Description (Optional)
            </Label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
              <Input
                id="description"
                placeholder="Core backend services and checkout microservices"
                className="pl-9 text-xs font-mono bg-surface-raised border-border-subtle focus-visible:border-brand"
                disabled={isSubmitting}
                {...register("description")}
              />
            </div>
            {errors.description && (
              <p className="text-[11px] font-mono text-danger">{errors.description.message}</p>
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
                <span>Provisioning Workspace...</span>
              </>
            ) : (
              <>
                <span>Continue to Target API Setup</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
