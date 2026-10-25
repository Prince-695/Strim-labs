export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(v: string): string | undefined {
  if (!v.trim()) return "Enter your email address.";
  if (!EMAIL.test(v.trim())) return "That doesn't look like an email address.";
}

export function validatePassword(v: string, min = 1): string | undefined {
  if (!v) return "Enter your password.";
  if (v.length < min) return `Use at least ${min} characters.`;
}

export function validateRequired(v: string, label: string): string | undefined {
  if (!v.trim()) return `Enter ${label}.`;
}

export function normalizeUrl(v: string): string {
  const trimmed = v.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("localhost") || trimmed.startsWith("127.0.0.1")) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

/** Accepts only http(s) URLs. Server-side SSRF validation remains authoritative. */
export function validateTargetUrl(v: string): string | undefined {
  if (!v.trim()) return "Enter the endpoint URL you want to test.";
  try {
    const normalized = normalizeUrl(v);
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Only http:// and https:// URLs are supported.";
    if (!u.hostname) return "That URL is missing a host.";
  } catch {
    return "Enter a valid URL, for example https://api.example.com/health.";
  }
}

export function hasErrors(e: FieldErrors): boolean {
  return Object.values(e).some(Boolean);
}
