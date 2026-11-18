"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Key,
  Plus,
  Copy,
  Check,
  RotateCw,
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { apikeyApi, type ApiKeyItem } from "@/lib/apikey-api"
import { useUIStore } from "@/lib/stores/ui-store"

export default function ApiKeysSettingsPage() {
  const queryClient = useQueryClient()
  const { currentOrgId, currentProjectId } = useUIStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [keyName, setKeyName] = React.useState("")
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null)
  const [copiedKey, setCopiedKey] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  // 1. Fetch API Keys List
  const { data: keysRes, isLoading } = useQuery({
    queryKey: ["api_keys", currentOrgId, currentProjectId],
    queryFn: () => apikeyApi.list(currentOrgId!, currentProjectId!),
    enabled: Boolean(currentOrgId && currentProjectId),
  })

  // 2. Create Key Mutation
  const createMutation = useMutation({
    mutationFn: () =>
      apikeyApi.create(currentOrgId!, currentProjectId!, {
        name: keyName,
        scopes: ["ingest", "read"],
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["api_keys", currentOrgId, currentProjectId] })
      setRevealedKey(res.data?.raw_key || "Generated")
      setIsCreateModalOpen(false)
      setKeyName("")
      setCreateError(null)
    },
    onError: (err: unknown) => {
      setCreateError(err instanceof Error ? err.message : "Failed to create API key.")
    },
  })

  // 3. Rotate Key Mutation
  const rotateMutation = useMutation({
    mutationFn: (keyId: string) =>
      apikeyApi.rotate(currentOrgId!, currentProjectId!, keyId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["api_keys", currentOrgId, currentProjectId] })
      setRevealedKey(res.data?.raw_key || "Rotated")
    },
  })

  // 4. Revoke Key Mutation
  const revokeMutation = useMutation({
    mutationFn: (keyId: string) =>
      apikeyApi.revoke(currentOrgId!, currentProjectId!, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api_keys", currentOrgId, currentProjectId] })
    },
  })

  const copySecret = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2500)
  }

  const keys = keysRes?.data || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold font-heading text-foreground">
            Project API Keys & Automation Tokens
          </h3>
          <p className="text-xs text-foreground-muted font-mono">
            Cryptographic keys used to ingest telemetry metrics and trigger load runners via CI/CD pipelines.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          disabled={!currentProjectId}
          className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
        >
          <Plus className="size-3.5" />
          <span>Generate API Key</span>
        </Button>
      </div>

      {/* Secret Reveal Banner */}
      {revealedKey && (
        <Card className="border-warning/40 bg-warning/5 shadow-xl">
          <CardContent className="p-4 space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2 text-warning font-semibold">
              <AlertTriangle className="size-4" />
              <span>Copy Your Secret Key Now</span>
            </div>
            <p className="text-[11px] text-foreground-muted">
              For security, this raw key will not be displayed again. Store it securely in your CI/CD environment variables.
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sand font-bold">
              <span className="truncate mr-2">{revealedKey}</span>
              <button
                onClick={() => copySecret(revealedKey)}
                className="text-foreground-subtle hover:text-foreground shrink-0"
              >
                {copiedKey ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </button>
            </div>
            <div className="text-right">
              <button
                onClick={() => setRevealedKey(null)}
                className="text-[10px] text-foreground-subtle hover:text-foreground"
              >
                Dismiss Key
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Key Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-border bg-surface shadow-2xl">
            <CardHeader className="pb-4 border-b border-border-subtle">
              <CardTitle className="text-base font-semibold font-heading text-foreground">
                Generate Ingestion API Key
              </CardTitle>
              <CardDescription className="text-xs text-foreground-muted font-mono">
                Assigned scopes: Telemetry Ingest & Read Observability.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-5 space-y-4 font-mono text-xs">
              {createError && (
                <div className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-danger">
                  {createError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-foreground-muted">Key Identifier / Label</label>
                <Input
                  placeholder="GitHub Actions CI Runner"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="text-xs font-mono bg-surface-raised border-border-subtle"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createMutation.isPending}
                  className="text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!keyName || createMutation.isPending}
                  className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Generating Key...</span>
                    </>
                  ) : (
                    <span>Create Secret Key</span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Keys Table Card */}
      <Card className="border-border bg-surface shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={<Key className="size-6 text-sand" />}
              title="No API Keys Provisioned"
              description="Generate a secret key to automate load tests and stream custom telemetry from your backend applications."
              action={
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-brand text-white hover:bg-brand-hover text-xs font-mono gap-1.5"
                >
                  <Plus className="size-3.5" />
                  <span>Generate Key</span>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-raised/40 text-[11px] text-foreground-subtle uppercase">
                    <th className="py-3 px-4 font-semibold">Key Name</th>
                    <th className="py-3 px-4 font-semibold">Prefix</th>
                    <th className="py-3 px-4 font-semibold">Scopes</th>
                    <th className="py-3 px-4 font-semibold">Created At</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {keys.map((k: ApiKeyItem) => (
                    <tr key={k.id} className="hover:bg-surface-raised/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {k.name}
                      </td>
                      <td className="py-3.5 px-4 text-sand">
                        <code>{k.key_prefix}...</code>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex gap-1.5">
                          {k.scopes.map((s) => (
                            <span
                              key={s}
                              className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-muted border border-border-subtle"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-foreground-subtle">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => rotateMutation.mutate(k.id)}
                            disabled={rotateMutation.isPending}
                            title="Rotate Key"
                            className="text-foreground-subtle hover:text-foreground p-1 rounded"
                          >
                            <RotateCw className="size-3.5" />
                          </button>
                          <button
                            onClick={() => revokeMutation.mutate(k.id)}
                            disabled={revokeMutation.isPending}
                            title="Revoke Key"
                            className="text-foreground-subtle hover:text-danger p-1 rounded"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
