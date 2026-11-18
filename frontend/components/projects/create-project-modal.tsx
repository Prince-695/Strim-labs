"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import {
  Server,
  Globe,
  Link2,
  ShieldAlert,
  Loader2,
  AlertCircle,
  ArrowRight,
  X,
  Layers,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CornerCrosshairs } from "@/components/landing/corner-crosshairs"
import { projectApi, type ProjectEnvironment } from "@/lib/project-api"
import { orgApi } from "@/lib/org-api"
import { useUIStore } from "@/lib/stores/ui-store"

const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(100),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug may only contain lowercase letters, numbers, and hyphens"
    ),
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

interface CreateProjectModalProps {
  isOpen?: boolean
  onClose?: () => void
  onSuccess?: (projectId: string) => void
}

export function CreateProjectModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  onSuccess,
}: CreateProjectModalProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const {
    currentOrgId,
    setCurrentOrgId,
    setCurrentProjectId,
    isCreateProjectOpen,
    setCreateProjectOpen,
  } = useUIStore()

  const isOpen =
    controlledIsOpen !== undefined ? controlledIsOpen : isCreateProjectOpen
  const handleClose = React.useCallback(() => {
    if (controlledOnClose) {
      controlledOnClose()
    } else {
      setCreateProjectOpen(false)
    }
  }, [controlledOnClose, setCreateProjectOpen])

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isManualSlug, setIsManualSlug] = React.useState(false)
  const [activeOrgId, setActiveOrgId] = React.useState<string>(
    currentOrgId || ""
  )

  // Sync activeOrgId when currentOrgId changes
  React.useEffect(() => {
    if (currentOrgId) {
      setActiveOrgId(currentOrgId)
    }
  }, [currentOrgId])

  // If no active org is set, resolve it from the org list
  React.useEffect(() => {
    if (isOpen && !activeOrgId) {
      const resolveOrg = async () => {
        try {
          const res = await orgApi.list()
          const orgs = res.data || []
          if (orgs.length > 0) {
            setActiveOrgId(orgs[0].id)
            setCurrentOrgId(orgs[0].id)
          }
        } catch {
          // ignore error here, will be caught during submission
        }
      }
      resolveOrg()
    }
  }, [isOpen, activeOrgId, setCurrentOrgId])

  // Prevent background scroll when modal is open
  React.useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, handleClose])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
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

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      setIsManualSlug(false)
      reset({
        name: "",
        slug: "",
        baseUrl: "",
        environment: "staging",
        authorized: false,
      })
    }
  }, [isOpen, reset])

  const projectName = watch("name")
  const selectedEnv = watch("environment")

  React.useEffect(() => {
    if (!isManualSlug && projectName) {
      setValue("slug", slugify(projectName), { shouldValidate: true })
    }
  }, [projectName, isManualSlug, setValue])

  const onSubmit = async (values: CreateProjectFormValues) => {
    let targetOrgId = activeOrgId || currentOrgId

    if (!targetOrgId) {
      try {
        const res = await orgApi.list()
        const orgs = res.data || []
        if (orgs.length > 0) {
          targetOrgId = orgs[0].id
          setActiveOrgId(targetOrgId)
          setCurrentOrgId(targetOrgId)
        }
      } catch {
        // failed to list orgs
      }
    }

    if (!targetOrgId) {
      setErrorMessage(
        "No organization workspace found. Please create an organization first."
      )
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)

      const res = await projectApi.create(targetOrgId, {
        name: values.name,
        slug: values.slug,
        base_url: values.baseUrl,
        environment: values.environment as ProjectEnvironment,
      })

      if (res.data?.id) {
        setCurrentProjectId(res.data.id)
        await queryClient.invalidateQueries({ queryKey: ["projects_list"] })
        await queryClient.invalidateQueries({ queryKey: ["projects"] })

        handleClose()

        if (onSuccess) {
          onSuccess(res.data.id)
        } else {
          router.push(`/dashboard/projects/${res.data.id}/verification`)
        }
      } else {
        handleClose()
        router.push("/dashboard/projects")
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage("Failed to register project target. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/75 p-4 backdrop-blur-md duration-150 fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose()
        }
      }}
    >
      <div className="relative w-full max-w-lg animate-in rounded-2xl border border-border bg-surface p-6 shadow-2xl duration-150 zoom-in-95 sm:p-7">
        <CornerCrosshairs />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] text-brand">
              <span className="size-1.5 animate-pulse rounded-full bg-brand" />
              <span>[TARGET API REGISTRATION]</span>
            </div>
            <h2
              id="create-project-title"
              className="font-heading text-lg font-bold text-foreground"
            >
              Register Target API Project
            </h2>
            <p className="text-xs text-foreground-muted">
              Configure the API endpoint URL you will be observing, probing, and
              load testing.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="-mt-1 -mr-1 rounded-lg p-1 text-foreground-subtle transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 pt-5">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {!activeOrgId && !currentOrgId ? (
            <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4 font-mono text-xs">
              <div className="flex items-center gap-2 font-semibold text-warning">
                <Layers className="size-4" />
                <span>No Organization Workspace Found</span>
              </div>
              <p className="text-[11px] leading-relaxed text-foreground-muted">
                Projects must belong to an organization workspace before
                registering targets.
              </p>
              <Button
                type="button"
                onClick={() => {
                  handleClose()
                  router.push("/onboarding/organization")
                }}
                className="h-9 w-full bg-brand font-mono text-xs text-white hover:bg-brand-hover"
              >
                Create Workspace Organization
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Project Name */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="create-project-name"
                  className="font-mono text-xs text-foreground-muted"
                >
                  Project Name
                </Label>
                <div className="relative">
                  <Server className="absolute top-2.5 left-3 size-4 text-foreground-subtle" />
                  <Input
                    id="create-project-name"
                    placeholder="Checkout API"
                    className="border-border-subtle bg-surface-raised pl-9 font-mono text-xs focus-visible:border-brand"
                    disabled={isSubmitting}
                    {...register("name")}
                  />
                </div>
                {errors.name && (
                  <p className="font-mono text-[11px] text-danger">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Project Slug */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="create-project-slug"
                  className="font-mono text-xs text-foreground-muted"
                >
                  Project Slug
                </Label>
                <div className="relative">
                  <Globe className="absolute top-2.5 left-3 size-4 text-foreground-subtle" />
                  <Input
                    id="create-project-slug"
                    placeholder="checkout-api"
                    className="border-border-subtle bg-surface-raised pl-9 font-mono text-xs focus-visible:border-brand"
                    disabled={isSubmitting}
                    {...register("slug", {
                      onChange: () => setIsManualSlug(true),
                    })}
                  />
                </div>
                {errors.slug && (
                  <p className="font-mono text-[11px] text-danger">
                    {errors.slug.message}
                  </p>
                )}
              </div>

              {/* Target Base URL */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="create-project-url"
                  className="font-mono text-xs text-foreground-muted"
                >
                  Target API Base URL
                </Label>
                <div className="relative">
                  <Link2 className="absolute top-2.5 left-3 size-4 text-foreground-subtle" />
                  <Input
                    id="create-project-url"
                    type="url"
                    placeholder="https://api.yourdomain.com"
                    className="border-border-subtle bg-surface-raised pl-9 font-mono text-xs focus-visible:border-brand"
                    disabled={isSubmitting}
                    {...register("baseUrl")}
                  />
                </div>
                {errors.baseUrl && (
                  <p className="font-mono text-[11px] text-danger">
                    {errors.baseUrl.message}
                  </p>
                )}
                <p className="font-mono text-[10px] text-foreground-subtle">
                  Netguard SSRF protection verifies this domain before
                  high-volume distributed runs.
                </p>
              </div>

              {/* Environment Selector */}
              <div className="space-y-1.5">
                <Label className="font-mono text-xs text-foreground-muted">
                  Environment
                </Label>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  {(["development", "staging", "production"] as const).map(
                    (env) => (
                      <button
                        type="button"
                        key={env}
                        onClick={() => setValue("environment", env)}
                        className={`rounded-lg border p-2 text-center capitalize transition-colors ${
                          selectedEnv === env
                            ? "border-brand bg-brand/10 font-medium text-white"
                            : "border-border-subtle bg-surface-raised text-foreground-subtle hover:text-foreground"
                        }`}
                      >
                        {env}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Safety Acknowledgement */}
              <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-start gap-2 font-mono text-xs font-semibold text-warning">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                  <span>Target Authorization Guarantee</span>
                </div>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-border-subtle bg-surface-raised text-brand focus:ring-brand"
                    {...register("authorized")}
                  />
                  <span className="font-mono text-[11px] leading-tight text-foreground-muted">
                    I certify that I own or have written authorization to load
                    test this target endpoint.
                  </span>
                </label>
                {errors.authorized && (
                  <p className="pl-6 font-mono text-[11px] text-danger">
                    {errors.authorized.message}
                  </p>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={handleClose}
                  className="h-10 border-border-subtle px-4 font-mono text-xs hover:bg-surface-raised"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 gap-2 bg-brand px-5 font-mono text-xs text-white hover:bg-brand-hover"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <span>Register & Verify</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
