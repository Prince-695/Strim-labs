import createClient from "openapi-fetch";
import type { paths, components } from "./generated/schema";
import { ApiError } from "./errors";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export const API_URL = API_BASE_URL;

export type Schemas = components["schemas"];

export type ApiInit = RequestInit & { orgId?: string; token?: string | null };
export async function api<T = unknown>(path: string, init?: ApiInit): Promise<T> {
  return fetchApi<T>(path, init);
}

/**
 * Storage accessor helpers for browser environment
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("strim_token");
  } catch {
    return null;
  }
}

export function getStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("strim_org_id");
  } catch {
    return null;
  }
}

// Global unauthorized callback (e.g. to sign out user)
let onUnauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorizedCallback = handler;
}

export function triggerUnauthorized() {
  if (onUnauthorizedCallback) {
    onUnauthorizedCallback();
  }
}

/**
 * Low-level openapi-fetch client with middleware for auth & tenant injection
 */
export const openapi = createClient<paths>({
  baseUrl: API_BASE_URL,
});

// Middleware to inject Authorization and x-organization-id
openapi.use({
  async onRequest({ request }) {
    const token = getStoredToken();
    if (token && !request.headers.has("Authorization")) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }

    const orgId = getStoredOrgId();
    if (orgId && !request.headers.has("x-organization-id")) {
      request.headers.set("x-organization-id", orgId);
    }

    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      triggerUnauthorized();
    }
    return response;
  },
});

/**
 * Robust typed fetch wrapper for REST queries & mutations
 */
export type RequestOptions = RequestInit & {
  token?: string | null;
  orgId?: string | null;
  params?: Record<string, string | number | boolean | undefined>;
};

export async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, orgId, params, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const headers = new Headers(customConfig.headers);
  if (!headers.has("Content-Type") && customConfig.body && typeof customConfig.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const authToken = token !== undefined ? token : getStoredToken();
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const tenantOrgId = orgId !== undefined ? orgId : getStoredOrgId();
  if (tenantOrgId) {
    headers.set("x-organization-id", tenantOrgId);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...customConfig, headers });
  } catch (err: any) {
    throw new ApiError(
      0,
      `Network Error: Failed to reach STRIM Labs API at ${API_BASE_URL}. Ensure the backend server is running.`,
      "NETWORK_ERROR"
    );
  }

  if (res.status === 401) {
    triggerUnauthorized();
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage =
      data.message || data.error || (data.code ? `Error: ${data.code}` : res.statusText);
    throw new ApiError(
      res.status,
      errorMessage,
      data.code,
      data.details,
      res.headers.get("x-request-id")
    );
  }

  return data as T;
}
