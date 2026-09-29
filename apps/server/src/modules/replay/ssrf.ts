/**
 * SSRF and Replay Bomb Defense Utility
 * Protects against internal network exploration, cloud metadata exfiltration,
 * and malicious replay targeting.
 */

// Blacklisted cloud metadata hostnames and IP addresses
const METADATA_HOSTS = new Set([
  "169.254.169.254", // AWS/GCP/Azure link-local metadata
  "metadata.google.internal",
  "100.100.100.200", // Alibaba Cloud metadata
  "fd00:ec2::254", // AWS IPv6 metadata
]);

/**
 * Checks if an IPv4 address falls within private/restricted ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const a = parts[0];
  const b = parts[1];
  if (a === undefined || b === undefined) return false;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (RFC 1918 Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (RFC 1918 Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (RFC 1918 Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link Local / Cloud Metadata)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8 (Broadcast/Current)
  if (a === 0) return true;

  return false;
}

export type SsrfValidationResult =
  | { safe: true; url: URL }
  | { safe: false; reason: string };

/**
 * Validates a target dispatch URL against SSRF vulnerabilities.
 * Allows localhost only in local development mode (NODE_ENV !== "production").
 */
export function validateReplayTargetUrl(rawUrl: string): SsrfValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Invalid target URL format" };
  }

  // 1. Only allow http: and https: protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject cloud metadata endpoints
  if (METADATA_HOSTS.has(hostname)) {
    return { safe: false, reason: "Access to cloud instance metadata service is strictly blocked (SSRF defense)." };
  }

  // 3. Reject IPv6 loopback and link-local
  if (hostname === "::1" || hostname.startsWith("fe80:") || hostname.startsWith("fc00:")) {
    return { safe: false, reason: "Access to IPv6 loopback or private address blocked." };
  }

  // 4. In production, block all loopback and RFC 1918 private IPs
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return { safe: false, reason: "Localhost access is prohibited in production replay." };
    }
    if (isPrivateIPv4(hostname)) {
      return { safe: false, reason: "Private network IP address blocked (RFC 1918 SSRF defense)." };
    }
  }

  return { safe: true, url: parsed };
}
