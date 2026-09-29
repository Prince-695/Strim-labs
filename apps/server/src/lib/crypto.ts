import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me-please-32ch-min-length";

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function validatePasswordComplexity(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  return { valid: true };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hmacSha256(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function hmacSignature(data: string, secret: string = JWT_SECRET): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export type SessionPayload = {
  userId: string;
  email: string;
  sessionId?: string;
  exp?: number;
};

export async function signSession(
  payload: { userId: string; email: string; sessionId?: string },
  expiresInMs = 7 * 24 * 3600 * 1000,
): Promise<string> {
  const data = {
    userId: payload.userId,
    email: payload.email,
    sessionId: payload.sessionId,
    exp: Date.now() + expiresInMs,
  };
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = hmacSignature(body);
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expectedSig = hmacSignature(body);
  if (!safeCompare(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (parsed.exp && parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
