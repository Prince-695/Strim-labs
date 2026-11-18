"use client"

import * as React from "react"
import {
  ConnectionIndicator,
  type ConnectionState,
} from "@/components/ui/connection-indicator"
import { tokenStorage, API_BASE_URL } from "@/lib/api-client"

interface LiveTickerData {
  ts: string
  rps: number
  p95: number
  p99: number
  error_rate: number
  requests_last_interval: number
}

interface LiveTickerProps {
  orgId: string
  projectId: string
  onUpdate?: (data: LiveTickerData) => void
}

export function LiveTicker({ orgId, projectId, onUpdate }: LiveTickerProps) {
  const isConfigured = Boolean(orgId && projectId)
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("disconnected")
  const [lastData, setLastData] = React.useState<LiveTickerData | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | undefined>(
    undefined
  )

  React.useEffect(() => {
    if (!orgId || !projectId) {
      return
    }

    let eventSource: EventSource | null = null
    let reconnectTimer: NodeJS.Timeout | null = null
    let isCancelled = false

    const connectSSE = () => {
      if (isCancelled) return

      const token = tokenStorage.get()
      const url = new URL(
        `${API_BASE_URL.replace(/\/+$/, "")}/organizations/${orgId}/projects/${projectId}/metrics/stream`
      )
      if (token) {
        url.searchParams.append("token", token)
      }

      try {
        eventSource = new EventSource(url.toString(), { withCredentials: true })

        eventSource.onopen = () => {
          if (!isCancelled) {
            setConnectionState("connected")
          }
        }

        eventSource.addEventListener("overview", (event: MessageEvent) => {
          if (isCancelled) return
          try {
            const parsed: LiveTickerData = JSON.parse(event.data)
            setLastData(parsed)
            setLastUpdated(new Date())
            setConnectionState("connected")
            if (onUpdate) onUpdate(parsed)
          } catch (e) {
            console.error("Failed to parse SSE overview data", e)
          }
        })

        eventSource.onerror = () => {
          if (isCancelled) return
          setConnectionState("stale")
          eventSource?.close()
          eventSource = null

          // Exponential backoff reconnect
          reconnectTimer = setTimeout(() => {
            if (!isCancelled) {
              setConnectionState("reconnecting")
              connectSSE()
            }
          }, 5000)
        }
      } catch {
        if (!isCancelled) {
          setConnectionState("stale")
          reconnectTimer = setTimeout(() => {
            if (!isCancelled) {
              setConnectionState("reconnecting")
              connectSSE()
            }
          }, 5000)
        }
      }
    }

    const initTimer = setTimeout(() => {
      if (!isCancelled) {
        setConnectionState("reconnecting")
        connectSSE()
      }
    }, 0)

    return () => {
      isCancelled = true
      clearTimeout(initTimer)
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
    }
  }, [orgId, projectId, onUpdate])

  const displayState = isConfigured ? connectionState : "disconnected"

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ConnectionIndicator state={displayState} lastUpdated={lastUpdated} />
      {lastData && (
        <div className="hidden items-center gap-3 rounded-md border border-border-subtle bg-surface-raised/40 px-2.5 py-1 font-mono text-xs text-foreground-muted sm:flex">
          <span>
            Live RPS:{" "}
            <strong className="text-foreground">
              {lastData.rps.toFixed(1)}
            </strong>
          </span>
          <span>•</span>
          <span>
            Live P95:{" "}
            <strong className="text-foreground">
              {lastData.p95.toFixed(1)}ms
            </strong>
          </span>
        </div>
      )}
    </div>
  )
}
