export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiInit = RequestInit & { token?: string | null; orgId?: string | null };

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { token, orgId, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (!headers.has("content-type") && rest.body && typeof rest.body === "string") {
    headers.set("content-type", "application/json");
  }
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (orgId) headers.set("x-organization-id", orgId);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  } catch {
    throw new ApiError(0, "Can't reach the STRIM API. Check that the server is running and NEXT_PUBLIC_API_URL is correct.");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      friendlyMessage(res.status, (data.message as string) || (data.error as string) || res.statusText),
      res.headers.get("x-request-id"),
    );
  }
  return data as T;
}

/** Normalises server errors into stable, non-technical messages. */
function friendlyMessage(status: number, raw: string): string {
  switch (status) {
    case 401:
      return "Your session has expired or the credentials are invalid.";
    case 403:
      return "You don't have permission to do that in this workspace.";
    case 404:
      return "We couldn't find that resource.";
    case 409:
      return raw || "That conflicts with something that already exists.";
    case 422:
      return raw || "Some of the values you entered aren't valid.";
    case 429:
      return "Too many requests. Wait a moment and try again.";
    default:
      if (status >= 500) return "The STRIM API ran into a problem. Try again in a moment.";
      return raw || "Something went wrong.";
  }
}
