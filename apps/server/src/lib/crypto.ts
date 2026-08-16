import { createHash, randomBytes } from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me-please-32ch";

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "argon2id" });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("hex");
}

export async function signSession(payload: { userId: string; email: string }): Promise<string> {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString(
    "base64url",
  );
  const sig = sha256(`${body}.${JWT_SECRET}`);
  return `${body}.${sig}`;
}

export function verifySession(token: string): { userId: string; email: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (sha256(`${body}.${JWT_SECRET}`) !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      userId: string;
      email: string;
      exp: number;
    };
    if (parsed.exp < Date.now()) return null;
    return { userId: parsed.userId, email: parsed.email };
  } catch {
    return null;
  }
}
