export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function api<T>(path: string, init: RequestInit & { token?: string; orgId?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.orgId) headers.set("x-organization-id", init.orgId);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? res.statusText);
  return data as T;
}
