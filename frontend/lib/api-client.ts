export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  access_token?: string
  data: T
  error?: string
  error_code?: string
  details?: unknown
  meta?: {
    limit: number
    next_cursor?: string
    has_more: boolean
    total?: number
  }
  request_id?: string
  response_time?: string
}

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown
  requestId?: string

  constructor(status: number, message: string, code = "UNKNOWN_ERROR", details?: unknown, requestId?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

const TOKEN_KEY = "strim_access_token"

export const tokenStorage = {
  get: (): string | null => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(TOKEN_KEY)
  },
  set: (token: string): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(TOKEN_KEY, token)
  },
  remove: (): void => {
    if (typeof window === "undefined") return
    localStorage.removeItem(TOKEN_KEY)
  },
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_API_BASE_URL ||
  "https://strim-labs.onrender.com/v1"

interface RequestOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { params, body, headers: customHeaders, ...customConfig } = options

  // Build full URL with query parameters
  const url = new URL(endpoint.startsWith("http") ? endpoint : `${API_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value))
      }
    })
  }

  const headers = new Headers(customHeaders)
  if (!headers.has("Content-Type") && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const token = tokenStorage.get()
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const config: RequestInit = {
    ...customConfig,
    headers,
    credentials: "include",
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  }

  try {
    const response = await fetch(url.toString(), config)
    const isJson = response.headers.get("content-type")?.includes("application/json")
    const payload = isJson ? await response.json() : null

    if (!response.ok) {
      const message = payload?.error || payload?.message || `Request failed with status ${response.status}`
      const code = payload?.error_code || "REQUEST_FAILED"
      throw new ApiError(response.status, message, code, payload?.details, payload?.request_id)
    }

    return payload as ApiResponse<T>
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    const message = err instanceof Error ? err.message : "Network error occurred"
    throw new ApiError(0, message, "NETWORK_ERROR")
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "PATCH", body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
}
