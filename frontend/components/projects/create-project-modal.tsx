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

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : isCreateProjectOpen
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
  const [activeOrgId, setActiveOrgId] = React.useState<string>(currentOrgId || "")

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
      setErrorMessage("No organization workspace found. Please create an organization first.")
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose()
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl p-6 sm:p-7 animate-in zoom-in-95 duration-150">
        <CornerCrosshairs />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-5 border-b border-border-subtle">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] text-brand">
              <span className="size-1.5 rounded-full bg-brand animate-pulse" />
              <span>[TARGET API REGISTRATION]</span>
            </div>
            <h2 id="create-project-title" className="text-lg font-heading font-bold text-foreground">
              Register Target API Project
            </h2>
            <p className="text-xs text-foreground-muted">
              Configure the API endpoint URL you will be observing, probing, and load testing.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="rounded-lg p-1 text-foreground-subtle hover:text-foreground hover:bg-surface-raised transition-colors -mr-1 -mt-1 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="pt-5 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {!activeOrgId && !currentOrgId ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-warning font-semibold">
                <Layers className="size-4" />
                <span>No Organization Workspace Found</span>
              </div>
              <p className="text-foreground-muted text-[11px] leading-relaxed">
                Projects must belong to an organization workspace before registering targets.
              </p>
              <Button
                type="button"
                onClick={() => {
                  handleClose()
                  router.push("/onboarding/organization")
                }}
                className="w-full bg-brand text-white hover:bg-brand-hover text-xs font-mono h-9"
              >
                Create Workspace Organization
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Project Name */}
              <div className="space-y-1.5">
                <Label htmlFor="create-project-name" className="text-xs font-mono text-foreground-muted">
                  Project Name
                </Label>
                <div className="relative">
                  <Server className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
                  <Input
                    id="create-project-name"
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
                <Label htmlFor="create-project-slug" className="text-xs font-mono text-foreground-muted">
                  Project Slug
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
                  <Input
                    id="create-project-slug"
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
                <Label htmlFor="create-project-url" className="text-xs font-mono text-foreground-muted">
                  Target API Base URL
                </Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 size-4 text-foreground-subtle" />
                  <Input
                    id="create-project-url"
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
                      className={`rounded-lg border p-2 text-center capitalize transition-colors ${
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

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={handleClose}
                  className="text-xs font-mono h-10 px-4 border-border-subtle hover:bg-surface-raised"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-brand text-white hover:bg-brand-hover text-xs font-mono h-10 px-5 gap-2"
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
