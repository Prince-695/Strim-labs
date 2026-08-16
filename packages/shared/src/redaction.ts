const REDACTED = "[REDACTED]";

const SENSITIVE_HEADER = /^(authorization|cookie|set-cookie|x-api-key|proxy-authorization)$/i;
const JWT = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const BEARER = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const API_KEY = /(?:api[_-]?key|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_\-]{8,}/gi;
const PASSWORD = /(?:password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PAN = /\b(?:\d[ -]*?){13,19}\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;

export type RedactionRule = {
  name: string;
  pattern: string;
  flags?: string;
};

export function redactString(value: string, extra: RedactionRule[] = []): string {
  let out = value
    .replace(JWT, REDACTED)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(API_KEY, REDACTED)
    .replace(PASSWORD, REDACTED)
    .replace(PAN, REDACTED)
    .replace(SSN, REDACTED)
    .replace(EMAIL, REDACTED);
  for (const rule of extra) {
    try {
      out = out.replace(new RegExp(rule.pattern, rule.flags ?? "gi"), REDACTED);
    } catch {
      // invalid user rule — skip
    }
  }
  return out;
}

export function redactHeaders(
  headers: Record<string, string | undefined>,
  extra: RedactionRule[] = [],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (SENSITIVE_HEADER.test(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = redactString(value, extra);
    }
  }
  return out;
}

export function redactJson(value: unknown, extra: RedactionRule[] = []): unknown {
  if (typeof value === "string") return redactString(value, extra);
  if (Array.isArray(value)) return value.map((v) => redactJson(v, extra));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/password|secret|token|authorization|cookie|card|cvv|ssn/i.test(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactJson(v, extra);
      }
    }
    return out;
  }
  return value;
}

const DANGEROUS_PATH = /(capture|charge|refund|payout|transfer|delete|destroy)/i;

export function isDangerousReplayTarget(method: string, path: string): boolean {
  return method.toUpperCase() !== "GET" && DANGEROUS_PATH.test(path);
}

export const REDACTED_PLACEHOLDER = REDACTED;
