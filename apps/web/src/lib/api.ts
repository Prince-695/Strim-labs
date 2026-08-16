export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { token?: string | null; orgId?: string | null } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.orgId) headers.set("x-organization-id", init.orgId);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? data.error ?? res.statusText);
  }
  return data as T;
}
